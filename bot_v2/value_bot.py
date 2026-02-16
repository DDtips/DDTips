#!/usr/bin/env python3
"""Standalone football value bot (does not modify existing app code)."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


DEFAULT_DAYS = 3
DEFAULT_MIN_EDGE_PCT = 10.0
DEFAULT_LIMIT = 8


@dataclass
class Pick:
    match_id: int | None
    match_date: str
    home_team: str
    away_team: str
    league: str | None
    side: str
    model_probability: float
    implied_probability: float
    book_odds: float
    ai_odds: float
    edge_pct: float
    lambda_total: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Football value bot for Over/Under 2.5 using existing predictions table."
    )
    parser.add_argument(
        "--days",
        type=int,
        default=int(os.getenv("BOT_LOOKAHEAD_DAYS", DEFAULT_DAYS)),
        help="How many days ahead to include fixtures.",
    )
    parser.add_argument(
        "--min-edge",
        type=float,
        default=float(os.getenv("BOT_MIN_EDGE_PCT", DEFAULT_MIN_EDGE_PCT)),
        help="Minimum edge %% to keep a pick.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=int(os.getenv("BOT_MAX_PICKS", DEFAULT_LIMIT)),
        help="Maximum number of picks to print/send.",
    )
    parser.add_argument(
        "--send-telegram",
        action="store_true",
        help="Send result to Telegram (requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON instead of human-friendly text.",
    )
    return parser.parse_args()


def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY.")
    return create_client(url, key)


def implied_prob(decimal_odds: float | None) -> float | None:
    if decimal_odds is None or decimal_odds <= 1.0:
        return None
    return 1.0 / decimal_odds


def value_pct(model_prob: float | None, decimal_odds: float | None) -> float | None:
    ip = implied_prob(decimal_odds)
    if ip is None or model_prob is None or model_prob <= 0:
        return None
    return ((model_prob / ip) - 1.0) * 100.0


def as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_match_row(row: dict[str, Any]) -> dict[str, Any]:
    match_payload = row.get("matches")
    if isinstance(match_payload, list):
        match = match_payload[0] if match_payload else {}
    elif isinstance(match_payload, dict):
        match = match_payload
    else:
        match = {}

    return {
        "match_id": row.get("match_id"),
        "match_date": str(match.get("match_date") or ""),
        "home_team": str(match.get("home_team") or ""),
        "away_team": str(match.get("away_team") or ""),
        "league": match.get("league"),
        "status": match.get("status"),
        "lambda_home": as_float(row.get("lambda_home")) or 0.0,
        "lambda_away": as_float(row.get("lambda_away")) or 0.0,
        "p_over_25": as_float(row.get("p_over_25")),
        "p_under_25": as_float(row.get("p_under_25")),
        "over_odds": as_float(row.get("over_odds")),
        "under_odds": as_float(row.get("under_odds")),
        "edge_over": as_float(row.get("edge_over")),
        "edge_under": as_float(row.get("edge_under")),
    }


def compute_best_pick(parsed: dict[str, Any]) -> Pick | None:
    p_over = parsed["p_over_25"]
    p_under = parsed["p_under_25"]
    over_odds = parsed["over_odds"]
    under_odds = parsed["under_odds"]

    if over_odds is None and under_odds is None:
        return None

    edge_over_pct = (
        parsed["edge_over"] * 100.0
        if parsed["edge_over"] is not None
        else value_pct(p_over, over_odds)
    )
    edge_under_pct = (
        parsed["edge_under"] * 100.0
        if parsed["edge_under"] is not None
        else value_pct(p_under, under_odds)
    )

    over_tuple = ("OVER", p_over, over_odds, edge_over_pct)
    under_tuple = ("UNDER", p_under, under_odds, edge_under_pct)

    candidate = max(
        [over_tuple, under_tuple],
        key=lambda t: t[3] if t[3] is not None else float("-inf"),
    )
    side, model_prob, odds, edge_pct = candidate
    if model_prob is None or odds is None or edge_pct is None:
        return None

    ip = implied_prob(odds)
    if ip is None:
        return None

    ai_odds = 1.0 / model_prob if model_prob > 0 else 0.0
    return Pick(
        match_id=parsed["match_id"],
        match_date=parsed["match_date"],
        home_team=parsed["home_team"],
        away_team=parsed["away_team"],
        league=parsed["league"],
        side=side,
        model_probability=model_prob,
        implied_probability=ip,
        book_odds=odds,
        ai_odds=ai_odds,
        edge_pct=edge_pct,
        lambda_total=(parsed["lambda_home"] + parsed["lambda_away"]),
    )


def fetch_candidates(sb: Client, from_date: str, to_date: str, limit: int) -> list[dict[str, Any]]:
    select_sql = """
        match_id,
        lambda_home,
        lambda_away,
        p_over_25,
        p_under_25,
        over_odds,
        under_odds,
        edge_over,
        edge_under,
        matches!inner (
            match_date,
            home_team,
            away_team,
            status,
            league
        )
    """

    try:
        response = (
            sb.table("predictions")
            .select(select_sql)
            .gte("matches.match_date", from_date)
            .lte("matches.match_date", to_date)
            .limit(max(limit, 50))
            .execute()
        )
        return response.data or []
    except Exception as exc:
        print(
            f"Warning: joined date filter failed ({exc}). Falling back to unfiltered fetch.",
            file=sys.stderr,
        )
        response = sb.table("predictions").select(select_sql).limit(max(limit, 200)).execute()
        rows = response.data or []
        return [
            r
            for r in rows
            if from_date <= str((r.get("matches") or {}).get("match_date", "")) <= to_date
        ]


def build_picks(rows: list[dict[str, Any]], min_edge_pct: float, max_picks: int) -> list[Pick]:
    picks: list[Pick] = []
    for row in rows:
        parsed = parse_match_row(row)
        if not parsed["match_date"] or not parsed["home_team"] or not parsed["away_team"]:
            continue
        if str(parsed.get("status") or "").upper() == "FINISHED":
            continue
        pick = compute_best_pick(parsed)
        if pick and pick.edge_pct >= min_edge_pct:
            picks.append(pick)

    picks.sort(key=lambda p: (-p.edge_pct, p.match_date, p.home_team, p.away_team))
    return picks[:max_picks]


def format_date_short(iso_date: str) -> str:
    try:
        dt = datetime.strptime(iso_date, "%Y-%m-%d")
        return dt.strftime("%d.%m")
    except ValueError:
        return iso_date


def build_message(
    picks: list[Pick], from_date: str, to_date: str, min_edge_pct: float, max_picks: int
) -> str:
    header = [
        "DD Value Bot",
        f"Period: {from_date} -> {to_date}",
        f"Min value edge: {min_edge_pct:.1f}%",
        "",
    ]

    if not picks:
        header.append("No value matches for the selected threshold.")
        return "\n".join(header)

    lines = header[:]
    for idx, pick in enumerate(picks, start=1):
        match_line = (
            f"{idx}. {pick.home_team} vs {pick.away_team} ({format_date_short(pick.match_date)})"
        )
        if pick.league:
            match_line += f" [{pick.league}]"
        lines.append(match_line)
        lines.append(
            f"   {pick.side} 2.5 @ {pick.book_odds:.2f} | AI kvota {pick.ai_odds:.2f}"
        )
        lines.append(
            f"   Edge {pick.edge_pct:+.1f}% | P={pick.model_probability*100:.1f}% | xG={pick.lambda_total:.2f}"
        )
        lines.append("")

    lines.append(f"Total picks: {len(picks)}/{max_picks}")
    lines.append("Betting is risky. Bet responsibly.")
    return "\n".join(lines)


def send_telegram(message: str) -> tuple[bool, str]:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return False, "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID."

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps(
        {"chat_id": chat_id, "text": message, "parse_mode": "HTML"}
    ).encode("utf-8")

    request = urllib.request.Request(
        url=url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8")
            return True, body
    except urllib.error.URLError as exc:
        return False, str(exc)


def main() -> int:
    load_dotenv()
    args = parse_args()

    today = date.today()
    from_date = today.isoformat()
    to_date = (today + timedelta(days=max(0, args.days))).isoformat()

    sb = get_supabase()
    rows = fetch_candidates(sb, from_date, to_date, args.limit)
    picks = build_picks(rows, min_edge_pct=args.min_edge, max_picks=args.limit)

    if args.json:
        print(
            json.dumps(
                {
                    "from": from_date,
                    "to": to_date,
                    "min_edge_pct": args.min_edge,
                    "limit": args.limit,
                    "count": len(picks),
                    "picks": [asdict(p) for p in picks],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        message = build_message(
            picks=picks,
            from_date=from_date,
            to_date=to_date,
            min_edge_pct=args.min_edge,
            max_picks=args.limit,
        )
        print(message)
        if args.send_telegram:
            ok, details = send_telegram(message)
            if not ok:
                print(f"\nTelegram send failed: {details}", file=sys.stderr)
                return 2
            print("\nTelegram sent.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
