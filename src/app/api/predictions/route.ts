import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const days = num(searchParams.get("days"), 30);
  const limit = num(searchParams.get("limit"), 200);

  // filters
  const onlyOdds = (searchParams.get("onlyOdds") ?? "0") === "1";
  const onlyValue = (searchParams.get("onlyValue") ?? "0") === "1";
  const valueThresholdPct = num(searchParams.get("valueThresholdPct"), 10); // 10%

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + Math.max(1, Math.min(90, days)));

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const sb = getSupabaseServer();

  const { data, error } = await sb
    .from("predictions")
    .select(
      `
      id,
      match_id,
      lambda_home,
      lambda_away,
      p_over_25,
      p_under_25,
      over_odds,
      under_odds,
      edge_over,
      edge_under,
      value_side,
      report,
      matches:match_id (
        match_date,
        home_team,
        away_team,
        status
      )
    `
    )
    .order("match_id", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const base = (data ?? []).filter((r: any) => {
    const md = r?.matches?.match_date;
    return md && md >= fromStr && md <= toStr;
  });

  const withOdds = base.filter((r: any) => r.over_odds != null || r.under_odds != null);

  // edge_over/edge_under sta pri tebi trenutno lahko "ratio" (npr 0.12 = 12%)
  // če sta null, ne more bit value
  const isValue = (r: any) => {
    const eo = typeof r.edge_over === "number" ? r.edge_over : null;
    const eu = typeof r.edge_under === "number" ? r.edge_under : null;
    const best = Math.max(eo ?? -999, eu ?? -999);
    return best >= valueThresholdPct / 100;
  };

  let rows = base;
  if (onlyOdds) rows = withOdds;
  if (onlyValue) rows = rows.filter(isValue);

  return NextResponse.json({
    from: fromStr,
    to: toStr,
    meta: {
      totalInRange: base.length,
      withOdds: withOdds.length,
      onlyOdds,
      onlyValue,
      valueThresholdPct,
    },
    rows,
  });
}
