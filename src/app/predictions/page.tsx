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

    // Filtri
    const onlyOdds = (searchParams.get("onlyOdds") ?? "0") === "1";
    const onlyValue = (searchParams.get("onlyValue") ?? "0") === "1";
    const valueThresholdPct = num(searchParams.get("valueThresholdPct"), 10); 

    // Datumi
    const from = new Date();
    // Odštejemo par ur, da ujamemo tekme, ki so se pravkar začele (za vsak slučaj)
    from.setHours(from.getHours() - 2); 
    
    const to = new Date();
    to.setDate(to.getDate() + Math.max(1, Math.min(90, days)));
    
    // Uporabimo ISO string za primerjavo v bazi
    const fromStr = from.toISOString();
    const toStr = to.toISOString();

    const sb = getSupabaseServer();

    // --- GLAVNA SPREMEMBA ---
    // Uporabimo matches!inner, da lahko filtriramo po datumu tekme direktno v bazi.
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
      // Tole je ključno: Filtriramo relacijo 'matches'
      // Baza bo vrnila samo vrstice, kjer je datum tekme med fromStr in toStr
      .gte("matches.match_date", fromStr)
      .lte("matches.match_date", toStr)
      .order("match_id", { ascending: false })
      .limit(limit);

    // Izvedemo poizvedbo
    const { data, error } = await query;

    if (error) {
      console.error("❌ Supabase Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Dodatno filtriranje v JS (če je potrebno za specifične pogoje)
    // Ampak glavnino je zdaj opravila baza
    let rows = data || [];

    const withOdds = rows.filter((r: any) => r.over_odds != null || r.under_odds != null);

    const isValue = (r: any) => {
      const eo = typeof r.edge_over === "number" ? r.edge_over : null;
      const eu = typeof r.edge_under === "number" ? r.edge_under : null;
      const best = Math.max(eo ?? -999, eu ?? -999);
      return best >= valueThresholdPct / 100;
    };

    if (onlyOdds) rows = withOdds;
    if (onlyValue) rows = rows.filter(isValue);

    return NextResponse.json({
      from: fromStr,
      to: toStr,
      meta: {
        totalInRange: (data || []).length,
        returned: rows.length,
        onlyOdds,
        onlyValue
      },
      rows,
    });

  } catch (err: any) {
    console.error("❌ Server Crash Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", message: err.message }, 
      { status: 500 }
    );
  }
}