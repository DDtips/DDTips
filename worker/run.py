import os
import math
import asyncio
from datetime import date, timedelta

from dotenv import load_dotenv
import aiohttp
from understat import Understat
from supabase import create_client

# -------------------- ENV --------------------
# Naloži .env datoteko iz iste mape, kjer je skripta
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") # Podpora za oba imena
FOOTBALL_DATA_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY")

ODDS_PROVIDER = (os.getenv("ODDS_PROVIDER") or "").strip().lower()
ODDS_API_KEY = os.getenv("ODDS_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# -------------------- CONFIG --------------------
FORM_N = 3        # heavy weight (form)
LONG_N = 10       # light weight (stability)
FORM_WEIGHT = 0.75
HOME_ADV = 1.10

SHOTS_IMPORT_LIMIT = 120
PREDICT_FINISHED_DEMO_N = 20
VALUE_PCT_THRESHOLD = 10.0

# --- KONFIGURACIJA LIG ---
# Povezava med imeni v Understat, Football-Data in TheOddsAPI
LEAGUES_MAP = {
    "EPL": {
        "understat": "EPL",
        "fd_code": "PL",
        "odds_key": "soccer_epl"
    },
    "La_liga": {
        "understat": "La_liga",
        "fd_code": "PD",
        "odds_key": "soccer_spain_la_liga"
    },
    "Bundesliga": {
        "understat": "Bundesliga",
        "fd_code": "BL1",
        "odds_key": "soccer_germany_bundesliga"
    },
    "Serie_A": {
        "understat": "Serie_A",
        "fd_code": "SA",
        "odds_key": "soccer_italy_serie_a"
    },
    "Ligue_1": {
        "understat": "Ligue_1",
        "fd_code": "FL1",
        "odds_key": "soccer_france_ligue_1"
    }
}


# -------------------- Helpers --------------------
def safe_float(x, default=0.0) -> float:
    try:
        if x is None:
            return default
        return float(x)
    except Exception:
        return default


def poisson_cdf(k: int, lam: float) -> float:
    s = 0.0
    for i in range(k + 1):
        s += math.exp(-lam) * (lam ** i) / math.factorial(i)
    return s


def p_over_25(lam_total: float) -> float:
    return 1.0 - poisson_cdf(2, lam_total)


def implied_prob(decimal_odds: float) -> float:
    if not decimal_odds or decimal_odds <= 1.0:
        return 0.0
    return 1.0 / decimal_odds


def normalize_team_name(name: str) -> str:
    return (name or "").strip()


def norm_team(s: str) -> str:
    s = (s or "").lower().strip()
    # remove common suffixes
    for suf in [" fc", " afc", " f.c.", " c.f.", " cf", " as", " ssc"]:
        if s.endswith(suf):
            s = s[: -len(suf)].strip()
    s = s.replace("&", "and")
    s = s.replace("utd", "united")
    s = " ".join(s.split())
    return s


def upsert_alias(source: str, source_name: str, canonical: str):
    sb.table("team_aliases").upsert(
        {"source": source, "source_name": source_name, "canonical_name": canonical},
        on_conflict="source,source_name",
    ).execute()


def canonical_from_alias(source: str, source_name: str) -> str:
    row = (
        sb.table("team_aliases")
        .select("canonical_name")
        .eq("source", source)
        .eq("source_name", source_name)
        .limit(1)
        .execute()
        .data
    )
    if row:
        return row[0]["canonical_name"]
    return source_name


def find_match_id(match_date: str, home: str, away: str):
    """Find matches.id for a given date+teams."""
    if not match_date or not home or not away:
        return None

    # 1) exact match
    q = (
        sb.table("matches")
        .select("id")
        .eq("match_date", match_date)
        .eq("home_team", home)
        .eq("away_team", away)
        .limit(1)
        .execute()
        .data
    )
    if q:
        return q[0]["id"]

    # 2) normalized fallback
    rows = (
        sb.table("matches")
        .select("id, home_team, away_team")
        .eq("match_date", match_date)
        .limit(80)
        .execute()
        .data
        or []
    )
    nh, na = norm_team(home), norm_team(away)
    for r in rows:
        if norm_team(r["home_team"]) == nh and norm_team(r["away_team"]) == na:
            return r["id"]

    return None


# -------------------- Retry wrapper --------------------
async def retry(coro_fn, tries=3, base_sleep=1.0, name="call"):
    last = None
    for i in range(tries):
        try:
            return await coro_fn()
        except Exception as e:
            last = e
            # print(f"Retry {i+1}/{tries} for {name} failed: {e}")
            await asyncio.sleep(base_sleep * (2 ** i))
    raise last


# -------------------- Understat fetch --------------------
async def fetch_understat_league_matches(league_name: str, season_year: int, session: aiohttp.ClientSession):
    """Fetch matches for a specific league from Understat."""
    us = Understat(session)
    return await us.get_league_results(league_name, season_year)


async def fetch_match_shots_understat(understat_match_id: str, session: aiohttp.ClientSession):
    us = Understat(session)
    return await us.get_match_shots(understat_match_id)


# -------------------- football-data.org --------------------
async def fd_get_json(url: str, session: aiohttp.ClientSession):
    if not FOOTBALL_DATA_API_KEY:
        return None
    headers = {"X-Auth-Token": FOOTBALL_DATA_API_KEY}
    async with session.get(url, headers=headers) as r:
        if r.status != 200:
            txt = await r.text()
            # 429 = Too Many Requests
            if r.status == 429:
                print("⚠️ Football-Data API rate limit reached. Waiting 10s...")
                await asyncio.sleep(10)
                return await fd_get_json(url, session) # Rekurzivni retry
            raise RuntimeError(f"football-data.org {r.status}: {txt[:200]}")
        return await r.json()


async def fetch_fd_fixtures(league_code: str, session: aiohttp.ClientSession, days_ahead: int = 30):
    if not FOOTBALL_DATA_API_KEY:
        return []
    date_from = date.today().isoformat()
    date_to = (date.today() + timedelta(days=days_ahead)).isoformat()
    # URL sedaj sprejme kodo lige (npr. PL, PD, BL1...)
    url = f"https://api.football-data.org/v4/competitions/{league_code}/matches?dateFrom={date_from}&dateTo={date_to}"
    j = await fd_get_json(url, session)
    return (j or {}).get("matches", []) or []


async def fetch_fd_standings(league_code: str, session: aiohttp.ClientSession):
    if not FOOTBALL_DATA_API_KEY:
        return []
    url = f"https://api.football-data.org/v4/competitions/{league_code}/standings"
    j = await fd_get_json(url, session)
    standings = (j or {}).get("standings", [])
    for s in standings:
        if s.get("type") == "TOTAL":
            return s.get("table", []) or []
    return []


# -------------------- DB upserts --------------------
def upsert_match_understat(season_year: int, league_name: str, m: dict):
    understat_id = str(m.get("id"))
    dt_str = m.get("datetime")
    match_date = dt_str.split(" ")[0] if dt_str else None

    home_src = (m.get("h") or {}).get("title") or ""
    away_src = (m.get("a") or {}).get("title") or ""
    home = canonical_from_alias("understat", home_src)
    away = canonical_from_alias("understat", away_src)

    upsert_alias("understat", home_src, home)
    upsert_alias("understat", away_src, away)

    hg = (m.get("goals") or {}).get("h")
    ag = (m.get("goals") or {}).get("a")
    status = "FINISHED" if (hg is not None and ag is not None) else "SCHEDULED"

    payload = {
        "season": season_year,
        "match_date": match_date,
        "home_team": home,
        "away_team": away,
        "home_goals": hg,
        "away_goals": ag,
        "understat_match_id": understat_id,
        "status": status,
        "league": league_name # Dodano: shranjujemo ime lige
    }

    sb.table("matches").upsert(payload, on_conflict="understat_match_id").execute()


def upsert_fixture_fd(fd_match: dict, league_name: str):
    utc_date = fd_match.get("utcDate")
    if not utc_date:
        return
    d = utc_date.split("T")[0]

    home_src = ((fd_match.get("homeTeam") or {}).get("name")) or ""
    away_src = ((fd_match.get("awayTeam") or {}).get("name")) or ""
    home = canonical_from_alias("football-data", home_src)
    away = canonical_from_alias("football-data", away_src)

    upsert_alias("football-data", home_src, home)
    upsert_alias("football-data", away_src, away)

    payload = {
        "season": int(d[:4]),
        "match_date": d,
        "home_team": home,
        "away_team": away,
        "status": "SCHEDULED",
        "league": league_name
    }

    # Preverimo če obstaja, da ne povozimo understat ID-ja
    existing = (
        sb.table("matches")
        .select("id")
        .eq("match_date", d)
        .eq("home_team", home)
        .eq("away_team", away)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        sb.table("matches").update(payload).eq("id", existing[0]["id"]).execute()
    else:
        sb.table("matches").insert(payload).execute()


def store_shots(db_match_id: int, shots_json: dict, home_team: str, away_team: str):
    rows = []
    for side_key, team_name in [("h", home_team), ("a", away_team)]:
        for s in shots_json.get(side_key, []):
            minute = int(s.get("minute", 0))
            xg = safe_float(s.get("xG", 0.0))
            is_goal = (str(s.get("result", "")).lower() == "goal")
            rows.append({
                "match_id": db_match_id,
                "team_name": team_name,
                "minute": minute,
                "xg": xg,
                "is_goal": is_goal
            })

    sb.table("shots").delete().eq("match_id", db_match_id).execute()
    if rows:
        sb.table("shots").insert(rows).execute()


# -------------------- Form metrics --------------------
def last_n_matches(team: str, as_of: date, n: int):
    as_of_str = as_of.isoformat()
    return (
        sb.table("matches")
        .select("id, match_date, home_team, away_team, home_goals, away_goals, status")
        .eq("status", "FINISHED")
        .lt("match_date", as_of_str)
        .or_(f"home_team.eq.{team},away_team.eq.{team}")
        .order("match_date", desc=True)
        .limit(n)
        .execute()
        .data
        or []
    )


def xg_for_against_for_match(match_id: int, team: str):
    shots = (
        sb.table("shots")
        .select("team_name, xg")
        .eq("match_id", match_id)
        .execute()
        .data
        or []
    )
    if not shots:
        return None, None
    xg_for = 0.0
    xg_against = 0.0
    for s in shots:
        tn = s["team_name"]
        xg = safe_float(s["xg"])
        if tn == team:
            xg_for += xg
        else:
            xg_against += xg
    return xg_for, xg_against


def goals_for_against(match: dict, team: str):
    home = match["home_team"]
    away = match["away_team"]
    hg = match.get("home_goals")
    ag = match.get("away_goals")
    if hg is None or ag is None:
        return 0, 0
    if team == home:
        return int(hg), int(ag)
    return int(ag), int(hg)


def compute_form(team: str, as_of: date, n: int):
    ms = last_n_matches(team, as_of, n)
    if not ms:
        return None

    total_xgf = 0.0
    total_xga = 0.0
    total_gf = 0
    total_ga = 0
    have_xg = 0

    for m in ms:
        gf, ga = goals_for_against(m, team)
        total_gf += gf
        total_ga += ga

        xgf, xga = xg_for_against_for_match(m["id"], team)
        if xgf is not None:
            total_xgf += xgf
            total_xga += (xga or 0.0)
            have_xg += 1

    games = len(ms)
    return {
        "games": games,
        "gf_pm": total_gf / games,
        "ga_pm": total_ga / games,
        "xgf_pm": (total_xgf / have_xg) if have_xg else None,
        "xga_pm": (total_xga / have_xg) if have_xg else None,
        "xg_coverage": have_xg / games
    }


def blend_form(form3: dict, form10: dict):
    def pick_xg_or_goals(f, key_xg, key_g):
        if f and f.get(key_xg) is not None:
            return float(f[key_xg])
        return float(f[key_g])

    xgf3 = pick_xg_or_goals(form3, "xgf_pm", "gf_pm")
    xga3 = pick_xg_or_goals(form3, "xga_pm", "ga_pm")
    xgf10 = pick_xg_or_goals(form10, "xgf_pm", "gf_pm") if form10 else xgf3
    xga10 = pick_xg_or_goals(form10, "xga_pm", "ga_pm") if form10 else xga3

    xgf = FORM_WEIGHT * xgf3 + (1 - FORM_WEIGHT) * xgf10
    xga = FORM_WEIGHT * xga3 + (1 - FORM_WEIGHT) * xga10
    return xgf, xga


# -------------------- Standings motivation --------------------
def load_latest_standings_map():
    rows = (
        sb.table("standings")
        .select("team_name, position, points, played, goal_diff, as_of_date")
        .order("as_of_date", desc=True)
        .limit(200) # Povečan limit, ker imamo zdaj 5 lig
        .execute()
        .data
        or []
    )
    m = {}
    for r in rows:
        # Če ekipa že obstaja v mapi, jo povozi samo če je datum novejši (zaradi orderja bo prvi že najnovejši)
        if r["team_name"] not in m:
            m[r["team_name"]] = r
    return m


def must_win_adjust(team: str, standings_map: dict) -> float:
    r = standings_map.get(team)
    if not r:
        return 1.00
    pos = r.get("position") or 0
    if pos >= 17:
        return 1.06
    if pos <= 6:
        return 1.04
    return 1.00


# -------------------- Odds (The Odds API) --------------------
async def fetch_odds_totals_25(sport_key: str, session: aiohttp.ClientSession):
    """
    Fetch odds for a specific sport key (league).
    """
    if ODDS_PROVIDER != "theoddsapi" or not ODDS_API_KEY:
        return []

    url = (
        f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds/"
        f"?apiKey={ODDS_API_KEY}&regions=eu&markets=totals&oddsFormat=decimal"
    )

    print(f"   Fetching odds for {sport_key}...")
    async with session.get(url) as r:
        if r.status != 200:
            txt = await r.text()
            print(f"   Odds Error {r.status}: {txt[:100]}")
            return []
        data = await r.json()

    out = []

    for ev in data:
        home_src = ev.get("home_team") or ""
        away_src = ev.get("away_team") or ""
        home = canonical_from_alias("odds", home_src)
        away = canonical_from_alias("odds", away_src)
        upsert_alias("odds", home_src, home)
        upsert_alias("odds", away_src, away)

        commence = ev.get("commence_time") or ""
        md = commence.split("T")[0] if "T" in commence else None
        if not md:
            continue

        best_over = None
        best_under = None
        best_over_bk = None
        best_under_bk = None

        for bk in ev.get("bookmakers", []) or []:
            bname = bk.get("title") or bk.get("key") or "bookmaker"
            totals = [m for m in (bk.get("markets") or []) if m.get("key") == "totals"]
            if not totals:
                continue

            m0 = totals[0]
            for o in m0.get("outcomes", []) or []:
                name = str(o.get("name") or "").lower()
                point = o.get("point")
                price = o.get("price")
                if point is None or price is None:
                    continue
                try:
                    if float(point) != 2.5:
                        continue
                    price = float(price)
                except Exception:
                    continue

                if name == "over":
                    if best_over is None or price > best_over:
                        best_over = price
                        best_over_bk = bname
                elif name == "under":
                    if best_under is None or price > best_under:
                        best_under = price
                        best_under_bk = bname

        if best_over and best_under:
            mid = find_match_id(md, home, away)
            out.append({
                "match_id": mid,
                "match_date": md,
                "home_team": home,
                "away_team": away,
                "bookmaker": f"BEST_OVER:{best_over_bk} | BEST_UNDER:{best_under_bk}",
                "market": "totals",
                "line": 2.5,
                "over_odds": best_over,
                "under_odds": best_under,
                "is_live": False
            })

    return out


def store_odds_snapshot(row: dict):
    sb.table("odds_snapshots").insert(row).execute()


def latest_odds_for_match_id(match_id: int):
    if not match_id:
        return None
    rows = (
        sb.table("odds_snapshots")
        .select("over_odds, under_odds, bookmaker, created_at")
        .eq("match_id", match_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


# -------------------- Prediction --------------------
def predict_match(match_row: dict, as_of: date, standings_map: dict):
    home = match_row["home_team"]
    away = match_row["away_team"]

    f3_home = compute_form(home, as_of, FORM_N) or {"gf_pm": 1.35, "ga_pm": 1.35, "xgf_pm": None, "xga_pm": None}
    f10_home = compute_form(home, as_of, LONG_N)
    f3_away = compute_form(away, as_of, FORM_N) or {"gf_pm": 1.35, "ga_pm": 1.35, "xgf_pm": None, "xga_pm": None}
    f10_away = compute_form(away, as_of, LONG_N)

    home_att, home_def = blend_form(f3_home, f10_home)
    away_att, away_def = blend_form(f3_away, f10_away)

    lam_home = ((home_att + away_def) / 2.0) * HOME_ADV
    lam_away = ((away_att + home_def) / 2.0)

    lam_home *= must_win_adjust(home, standings_map)
    lam_away *= must_win_adjust(away, standings_map)

    lam_total = lam_home + lam_away
    p_over = p_over_25(lam_total)
    p_under = 1.0 - p_over

    # odds + value%
    over_odds = None
    under_odds = None
    value_over_pct = None
    value_under_pct = None
    value_side = None

    o = latest_odds_for_match_id(match_row["id"])
    if o:
        over_odds = safe_float(o.get("over_odds"), None)
        under_odds = safe_float(o.get("under_odds"), None)

        if over_odds:
            ip = implied_prob(over_odds)
            if ip > 0:
                value_over_pct = ((p_over / ip) - 1.0) * 100.0

        if under_odds:
            ip = implied_prob(under_odds)
            if ip > 0:
                value_under_pct = ((p_under / ip) - 1.0) * 100.0

        best_val = max(value_over_pct if value_over_pct is not None else -999,
                       value_under_pct if value_under_pct is not None else -999)
        if best_val >= VALUE_PCT_THRESHOLD:
            value_side = "OVER" if (value_over_pct or -999) >= (value_under_pct or -999) else "UNDER"

    report_lines = [
        f"Napoved (forma zadnje {FORM_N}): λ_total={lam_total:.2f} (λ {home}={lam_home:.2f}, λ {away}={lam_away:.2f})",
        f"P(Over 2.5)={p_over:.2f} · P(Under 2.5)={p_under:.2f}",
        f"{home} zadnje {FORM_N}: xG/tekma ~ {f3_home.get('xgf_pm') if f3_home.get('xgf_pm') is not None else f3_home.get('gf_pm'):.2f} za · {f3_home.get('xga_pm') if f3_home.get('xga_pm') is not None else f3_home.get('ga_pm'):.2f} proti",
        f"{away} zadnje {FORM_N}: xG/tekma ~ {f3_away.get('xgf_pm') if f3_away.get('xgf_pm') is not None else f3_away.get('gf_pm'):.2f} za · {f3_away.get('xga_pm') if f3_away.get('xga_pm') is not None else f3_away.get('ga_pm'):.2f} proti",
    ]

    if over_odds and under_odds:
        report_lines.append(f"Bet odds: Over 2.5={over_odds:.2f}, Under 2.5={under_odds:.2f}")
        if value_over_pct is not None and value_under_pct is not None:
            report_lines.append(f"Value %: Over={value_over_pct:+.1f}%, Under={value_under_pct:+.1f}% (threshold {VALUE_PCT_THRESHOLD:.0f}%)")
        if value_side:
            report_lines.append(f"VALUE signal: {value_side}")

    report = "\n".join(report_lines)

    sb.table("predictions").delete().eq("match_id", match_row["id"]).execute()
    sb.table("predictions").insert({
        "match_id": match_row["id"],
        "lambda_home": lam_home,
        "lambda_away": lam_away,
        "p_over_25": p_over,
        "p_under_25": p_under,
        "report": report,
        "over_odds": over_odds,
        "under_odds": under_odds,
        "edge_over": value_over_pct / 100.0 if value_over_pct is not None else None,
        "edge_under": value_under_pct / 100.0 if value_under_pct is not None else None,
        "value_side": value_side,
    }).execute()


# -------------------- Main --------------------
async def main():
    today = date.today()
    seasons = [today.year - 1, today.year]
    timeout = aiohttp.ClientTimeout(total=60) # Povečan timeout

    print("=== STARTING WORKER ===")

    async with aiohttp.ClientSession(timeout=timeout) as session:
        
        # --- 1. UNDERSTAT HISTORY (za vse lige) ---
        print("\nSTEP 1: Fetching Understat history for ALL leagues...")
        for league_name, config in LEAGUES_MAP.items():
            print(f" -> Processing league: {league_name}")
            for season in seasons:
                try:
                    matches = await retry(lambda: fetch_understat_league_matches(config["understat"], season, session), tries=3, base_sleep=1.0, name=f"understat_{league_name}")
                    if matches:
                        print(f"    Fetched {len(matches)} matches for season {season}")
                    for m in matches:
                        upsert_match_understat(season, league_name, m)
                except Exception as e:
                    print(f"    ❌ ERROR fetching Understat {league_name} season {season}: {e}")
                    continue
        print("STEP 1 DONE.")

        # --- 2. FIXTURES & STANDINGS (football-data.org) ---
        if FOOTBALL_DATA_API_KEY:
            print("\nSTEP 2: Fetching fixtures & standings from football-data.org...")
            for league_name, config in LEAGUES_MAP.items():
                fd_code = config["fd_code"]
                print(f" -> Processing {league_name} (Code: {fd_code})")
                
                # Fixtures
                try:
                    fixtures = await fetch_fd_fixtures(fd_code, session, days_ahead=30)
                    print(f"    Found {len(fixtures)} upcoming fixtures")
                    for fx in fixtures:
                        upsert_fixture_fd(fx, league_name)
                except Exception as e:
                    print(f"    ❌ ERROR fixtures for {league_name}: {e}")

                # Standings
                try:
                    table = await fetch_fd_standings(fd_code, session)
                    as_of = today.isoformat()
                    season_int = today.year
                    rows = []
                    for r in table:
                        tname = normalize_team_name((r.get("team") or {}).get("name") or "")
                        tcanon = canonical_from_alias("football-data", tname)
                        upsert_alias("football-data", tname, tcanon)
                        rows.append({
                            "season": season_int,
                            "as_of_date": as_of,
                            "team_name": tcanon,
                            "position": r.get("position"),
                            "points": r.get("points"),
                            "played": r.get("playedGames"),
                            "goal_diff": r.get("goalDifference"),
                        })
                    if rows:
                        for rr in rows:
                            sb.table("standings").upsert(rr, on_conflict="season,as_of_date,team_name").execute()
                except Exception as e:
                    print(f"    ❌ ERROR standings for {league_name}: {e}")
            print("STEP 2 DONE.")
        else:
            print("STEP 2 SKIP: API key missing.")

        # --- 3. SHOTS DATA (Understat) ---
        print(f"\nSTEP 3: Import shots for last {SHOTS_IMPORT_LIMIT} finished matches...")
        finished = (
            sb.table("matches")
            .select("id, understat_match_id, home_team, away_team, match_date")
            .eq("status", "FINISHED")
            .order("match_date", desc=True)
            .limit(SHOTS_IMPORT_LIMIT)
            .execute()
            .data
            or []
        )

        for m in finished:
            db_match_id = m["id"]
            # Preverimo, če že imamo shote
            existing = sb.table("shots").select("id").eq("match_id", db_match_id).limit(1).execute().data
            if existing:
                continue
            
            understat_id = m.get("understat_match_id")
            if not understat_id:
                continue
            
            try:
                # Malo pavze da ne ubijemo API-ja
                # await asyncio.sleep(0.2) 
                shots_json = await retry(lambda: fetch_match_shots_understat(understat_id, session), tries=3, base_sleep=1.0, name="shots")
                store_shots(db_match_id, shots_json, m["home_team"], m["away_team"])
            except Exception as e:
                print(f"  ❌ ERROR shots id={understat_id}: {e}")
        print("STEP 3 DONE.")

        # --- 4. ODDS SNAPSHOTS ---
        if ODDS_PROVIDER and ODDS_API_KEY:
            print(f"\nSTEP 4: Fetching Odds ({ODDS_PROVIDER})...")
            
            for league_name, config in LEAGUES_MAP.items():
                odds_key = config["odds_key"]
                try:
                    odds_rows = await retry(lambda: fetch_odds_totals_25(odds_key, session), tries=3, base_sleep=1.0, name=f"odds_{league_name}")
                    
                    linked_count = 0
                    for r in odds_rows:
                        if r.get("match_id"):
                            linked_count += 1
                        store_odds_snapshot(r)
                    print(f"    {league_name}: Stored {len(odds_rows)} odds (Linked to matches: {linked_count})")
                    
                except Exception as e:
                    print(f"    ❌ ERROR odds for {league_name}: {e}")
            print("STEP 4 DONE.")
        else:
            print("STEP 4 SKIP: Odds API key missing.")

    # --- 5. PREDICTIONS ---
    standings_map = load_latest_standings_map()
    date_from = today.isoformat()
    date_to = (today + timedelta(days=30)).isoformat()

    # Najdi tekme za napoved (danes + 30 dni)
    upcoming = (
        sb.table("matches")
        .select("id, match_date, home_team, away_team, status, league")
        .gte("match_date", date_from)
        .lte("match_date", date_to)
        .order("match_date", desc=False)
        .execute()
        .data
        or []
    )
    
    # Če ni prihodnjih tekem, za demo vzemi zadnje končane
    is_demo = False
    if not upcoming:
        is_demo = True
        upcoming = (
            sb.table("matches")
            .select("id, match_date, home_team, away_team, status, league")
            .eq("status", "FINISHED")
            .order("match_date", desc=True)
            .limit(PREDICT_FINISHED_DEMO_N)
            .execute()
            .data
            or []
        )
        print(f"\nSTEP 5: Predicting {len(upcoming)} matches (DEMO MODE - last finished)...")
    else:
        print(f"\nSTEP 5: Predicting {len(upcoming)} upcoming matches...")

    for m in upcoming:
        try:
            await asyncio.sleep(0.2)
            predict_match(m, today, standings_map)
        except Exception as e:
            print(f"  ❌ ERROR predicting match_id={m.get('id')}: {e}")

    print("\n=== WORKER FINISHED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(main())