import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// To zagotovi, da se podatki ne shranjujejo v cache (vedno sveže)
export const dynamic = "force-dynamic";

function getSupabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const sb = getSupabaseServer();

    // Poizvedba BREZ datumskih filtrov
    // Vzame zadnjih 50 vnosov (glede na ID), ne glede na datum
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
        matches!inner (
          match_date,
          home_team,
          away_team,
          status
        )
      `
      )
      .order("id", { ascending: false }) // Vzame zadnje vnesene vrstice
      .limit(50); // Omeji na 50 rezultatov

    if (error) {
      console.error("❌ Supabase Error:", error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    // Uspešno
    return NextResponse.json({
      meta: {
        message: "Prikazujem zadnjih 50 vnosov brez časovnega filtra",
        count: (data || []).length
      },
      rows: data || [],
    });

  } catch (err: any) {
    console.error("❌ Server Crash:", err);
    return NextResponse.json(
      { error: "Internal Server Error", message: err.message }, 
      { status: 500 }
    );
  }
}