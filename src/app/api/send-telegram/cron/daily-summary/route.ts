import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // DEBUG - preveri ali so env variables nastavljeni
    const debugInfo = {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      urlPreview: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "..."
    };

    // Današnji datum v slovenskem času
    const now = new Date();
    const slovenianFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Ljubljana",
      year: "numeric",
      month: "2-digit", 
      day: "2-digit",
    });
    const todayStr = slovenianFormatter.format(now);
    
    // Včerajšnji datum
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = slovenianFormatter.format(yesterday);

    // Poizvedba
    const { data: bets, error } = await supabase
      .from("bets")
      .select("*")
      .eq("datum", yesterdayStr);

    return NextResponse.json({ 
      debug: debugInfo,
      danes: todayStr,
      iskan_datum: yesterdayStr,
      error: error?.message || null,
      najdeno: bets?.length ?? 0,
      prvih2: bets?.slice(0, 2) || []
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}