import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // 1. Izračun včerajšnjega datuma
    const d = new Date();
    d.setHours(d.getHours() + 1); // Prilagodba na SLO čas
    d.setDate(d.getDate() - 1);
    const dateStr = d.toISOString().split('T')[0];

    // 2. DIAGNOSTIKA: Poglejmo, kaj je sploh v bazi
    const { data: rawBets } = await supabase
      .from("bets")
      .select("datum")
      .limit(5)
      .order("datum", { ascending: false });

    // 3. Poskus iskanja stav
    const { data: bets, error } = await supabase
      .from("bets")
      .select("*")
      .eq("datum", dateStr);

    if (error) throw error;

    if (!bets || bets.length === 0) {
      return NextResponse.json({ 
        message: "Ni stav.",
        iskan_datum: dateStr,
        kaj_vidi_baza: rawBets // TUKAJ BOVA VIDELA ODGOVOR
      });
    }

    return NextResponse.json({ success: true, najdeno: bets.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}