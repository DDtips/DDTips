import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// (Tukaj bi morala biti ista funkcija calcProfit kot zgoraj - kopiraj jo iz daily-summary)
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
    // 1. DOLOČI PREJŠNJI MESEC
    const now = new Date();
    // Gremo na 0-ti dan tega meseca = zadnji dan prejšnjega meseca
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth(), 0); 
    const year = lastMonthDate.getFullYear();
    const month = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
    const searchString = `${year}-${month}`; // Npr "2024-01"

    // 2. PREBERI STAVE ZA CEL MESEC
    const { data: bets } = await supabase.from("bets").select("*").ilike("datum", `${searchString}%`);

    if (!bets || bets.length === 0) return NextResponse.json({ message: "Ni stav za prejšnji mesec." });

    // 3. IZRAČUN
    let profit = 0; let wins = 0; let turnover = 0;
    bets.forEach((b) => {
      profit += calcProfit(b);
      turnover += (b.vplacilo1 || 0) + (b.vplacilo2 || 0);
      if (["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)) wins++;
    });

    // ROI izračun (Profit / Vplačila * 100)
    const roi = turnover > 0 ? ((profit / turnover) * 100).toFixed(2) : "0";
    const sign = profit > 0 ? "+" : "";

    // 4. POŠLJI
    const msg = `<b>📅 POROČILO ZA MESEC ${month}/${year}</b>

💰 <b>Profit: ${sign}${profit.toFixed(2)}€</b>
📈 ROI: ${roi}%
🏆 Zmage: ${wins} / Skupaj stav: ${bets.length}`;

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