import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type MatchPayload = {
  match_date?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  status?: string | null;
  league?: string | null;
  home_goals?: number | null;
  away_goals?: number | null;
};

type PredictionRow = {
  match_id: number | null;
  lambda_home: number | null;
  lambda_away: number | null;
  p_over_25: number | null;
  p_under_25: number | null;
  over_odds: number | null;
  under_odds: number | null;
  edge_over: number | null;
  edge_under: number | null;
  matches: MatchPayload | MatchPayload[] | null;
};

type DerivedPick = {
  match_id: number | null;
  match_date: string;
  home_team: string;
  away_team: string;
  league: string | null;
  status: string;
  home_goals: number | null;
  away_goals: number | null;
  side: "OVER" | "UNDER";
  edge_pct: number;
  model_probability: number;
  implied_probability: number | null;
  book_odds: number;
  ai_odds: number | null;
  lambda_total: number;
};

function getSupabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toImpliedProbability(odds: number | null): number | null {
  if (!odds || odds <= 1) return null;
  return 1 / odds;
}

function calcValuePct(modelProbability: number | null, odds: number | null): number | null {
  const implied = toImpliedProbability(odds);
  if (!modelProbability || modelProbability <= 0 || !implied) return null;
  return ((modelProbability / implied) - 1) * 100;
}

function parseMatch(payload: MatchPayload | MatchPayload[] | null): MatchPayload {
  if (!payload) return {};
  if (Array.isArray(payload)) return payload[0] ?? {};
  return payload;
}

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function clampFloat(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function buildPick(row: PredictionRow, minEdgePct: number): DerivedPick | null {
  const match = parseMatch(row.matches);
  const matchDate = (match.match_date ?? "").slice(0, 10);
  const status = (match.status ?? "SCHEDULED").toUpperCase();

  if (!matchDate || !match.home_team || !match.away_team) {
    return null;
  }

  const pOver = toNumber(row.p_over_25);
  const pUnder = toNumber(row.p_under_25);
  const overOdds = toNumber(row.over_odds);
  const underOdds = toNumber(row.under_odds);

  const edgeOverRaw = toNumber(row.edge_over);
  const edgeUnderRaw = toNumber(row.edge_under);
  const edgeOverPct = edgeOverRaw !== null ? edgeOverRaw * 100 : calcValuePct(pOver, overOdds);
  const edgeUnderPct = edgeUnderRaw !== null ? edgeUnderRaw * 100 : calcValuePct(pUnder, underOdds);

  const overEdge = edgeOverPct ?? Number.NEGATIVE_INFINITY;
  const underEdge = edgeUnderPct ?? Number.NEGATIVE_INFINITY;
  const side: "OVER" | "UNDER" = overEdge >= underEdge ? "OVER" : "UNDER";
  const edgePct = side === "OVER" ? edgeOverPct : edgeUnderPct;
  const modelProbability = side === "OVER" ? pOver : pUnder;
  const bookOdds = side === "OVER" ? overOdds : underOdds;

  if (
    edgePct === null ||
    modelProbability === null ||
    bookOdds === null ||
    edgePct < minEdgePct
  ) {
    return null;
  }

  return {
    match_id: row.match_id,
    match_date: matchDate,
    home_team: match.home_team,
    away_team: match.away_team,
    league: match.league ?? null,
    status,
    home_goals: toNumber(match.home_goals),
    away_goals: toNumber(match.away_goals),
    side,
    edge_pct: edgePct,
    model_probability: modelProbability,
    implied_probability: toImpliedProbability(bookOdds),
    book_odds: bookOdds,
    ai_odds: modelProbability > 0 ? 1 / modelProbability : null,
    lambda_total: (toNumber(row.lambda_home) ?? 0) + (toNumber(row.lambda_away) ?? 0),
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = clampInt(url.searchParams.get("days"), 3, 0, 30);
    const minEdgePct = clampFloat(url.searchParams.get("minEdgePct"), 10, 10, 100);
    const limit = clampInt(url.searchParams.get("limit"), 12, 1, 100);
    const historyLimit = clampInt(url.searchParams.get("historyLimit"), 25, 5, 100);

    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const toDate = new Date(today);
    toDate.setDate(toDate.getDate() + days);
    const to = toDate.toISOString().slice(0, 10);

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from("predictions")
      .select(
        `
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
          league,
          home_goals,
          away_goals
        )
      `
      )
      .order("id", { ascending: false })
      .limit(4000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const picks = ((data ?? []) as PredictionRow[])
      .map((row) => buildPick(row, minEdgePct))
      .filter((r): r is DerivedPick => r !== null);

    const upcomingRows = picks
      .filter((row) => row.status !== "FINISHED" && row.match_date >= from && row.match_date <= to)
      .sort((a, b) => b.edge_pct - a.edge_pct || a.match_date.localeCompare(b.match_date))
      .map(({ status: _status, home_goals: _hg, away_goals: _ag, ...row }) => row)
      .slice(0, limit);

    const settledRowsRaw = picks
      .filter(
        (row) =>
          row.status === "FINISHED" &&
          row.home_goals !== null &&
          row.away_goals !== null &&
          row.book_odds > 1
      )
      .map((row) => {
        const totalGoals = (row.home_goals as number) + (row.away_goals as number);
        const actualSide: "OVER" | "UNDER" = totalGoals >= 3 ? "OVER" : "UNDER";
        const isHit = row.side === actualSide;
        const profitUnits = isHit ? row.book_odds - 1 : -1;
        return {
          ...row,
          total_goals: totalGoals,
          actual_side: actualSide,
          is_hit: isHit,
          profit_units: profitUnits,
        };
      })
      .sort((a, b) => b.match_date.localeCompare(a.match_date));

    const settledTotal = settledRowsRaw.length;
    const wins = settledRowsRaw.filter((row) => row.is_hit).length;
    const losses = settledTotal - wins;
    const hitRatePct = settledTotal > 0 ? (wins / settledTotal) * 100 : 0;
    const avgEdgePct =
      settledTotal > 0
        ? settledRowsRaw.reduce((acc, row) => acc + row.edge_pct, 0) / settledTotal
        : 0;
    const avgOdds =
      settledTotal > 0
        ? settledRowsRaw.reduce((acc, row) => acc + row.book_odds, 0) / settledTotal
        : 0;
    const profitUnits = settledRowsRaw.reduce((acc, row) => acc + row.profit_units, 0);
    const roiPct = settledTotal > 0 ? (profitUnits / settledTotal) * 100 : 0;

    return NextResponse.json({
      meta: {
        from,
        to,
        days,
        minEdgePct,
        limit,
        historyLimit,
        count: upcomingRows.length,
        scanned: picks.length,
      },
      stats: {
        thresholdPct: minEdgePct,
        settledTotal,
        wins,
        losses,
        hitRatePct,
        avgEdgePct,
        avgOdds,
        profitUnits,
        roiPct,
      },
      rows: upcomingRows,
      settledRows: settledRowsRaw.slice(0, historyLimit).map(({ status: _status, home_goals: _hg, away_goals: _ag, ...row }) => row),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal Server Error", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
