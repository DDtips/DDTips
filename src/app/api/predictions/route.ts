import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = num(searchParams.get("days"), 30);
    const limit = num(searchParams.get("limit"), 200);

    // Nastavitev datumov (od zdaj - 2 uri, do X dni v prihodnost)
    const from = new Date();
    from.setHours(from.getHours() - 2); 
    
    const to = new Date();
    to.setDate(to.getDate() + Math.max(1, Math.min(90, days)));
    
    const fromStr = from.toISOString();
    const toStr = to.toISOString();

    const sb = getSupabaseServer();

    // Poizvedba z matches!inner (filtriranje datumov v bazi)
    let query = sb
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
        matches!inner (
          match_date,
          home_team,
          away_team,
          status
        )
      `
      )
      .gte("matches.match_date", fromStr)
      .lte("matches.match_date", toStr)
      .order("match_id", { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      rows: data || [],
    });

  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", message: err.message }, 
      { status: 500 }
    );
  }
}