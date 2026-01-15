import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inicializacija
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Funkcija za profit (enaka kot na frontendu)
function calcProfit(b: any) {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;
  const kom = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0; const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0; const layOdds = b.lay_kvota || 0;
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;
  let p = 0;
  const hasBack = (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0;
  const hasLay = (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0;

  if (hasBack && hasLay) {
    const pBack = (backStake * (backOdds - 1)) - layLiability;
    const pLay = layStake - backStake;
    if (b.wl === "BACK WIN") p = pBack; else if (b.wl === "LAY WIN") p = pLay;
    else if (b.wl === "WIN") p = Math.max(pBack, pLay); else if (b.wl === "LOSS") p = Math.min(pBack, pLay);
  } else if (!hasBack && hasLay) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") p = layStake; else p = -layLiability;
  } else if (hasBack && !hasLay) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") p = backStake * (backOdds - 1); else p = -backStake;
  }
  return p > 0 ? p - kom : p;
}

export async function GET() {
  try {
    // 1. DOLOČI VČERAJŠNJI DATUM
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    const displayDate = `${yesterday.getDate()}.${yesterday.getMonth() + 1}`;

    // 2. PREBERI STAVE
    const { data: bets } = await supabase.from("bets").select("*").eq("datum", dateStr);

    if (!bets || bets.length === 0) return NextResponse.json({ message: "Ni stav." });

    // 3. SEŠTEJ STATISTIKO
    let profit = 0; let wins = 0; let losses = 0;
    bets.forEach((b) => {
      profit += calcProfit(b);
      if (["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)) wins++;
      if (b.wl === "LOSS") losses++;
    });

    const emoji = profit >= 0 ? "✅" : "🔻";
    const sign = profit > 0 ? "+" : "";

    // 4. POŠLJI (Format za iPhone)
    const msg = `<b>📊 ANALIZA VČERAJ (${displayDate})</b>
💰 <b>Profit: ${sign}${profit.toFixed(2)}€</b>
${emoji} W: ${wins} / L: ${losses} (${bets.length} stav)`;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (token && chatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
        });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}