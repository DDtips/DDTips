import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function calcProfit(b: any) {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;
  const kom = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0; 
  const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0; 
  const layOdds = b.lay_kvota || 0;
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;
  
  let p = 0;
  const hasBack = (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0;
  const hasLay = (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0;

  if (hasBack && hasLay) {
    const pBack = (backStake * (backOdds - 1)) - layLiability;
    const pLay = layStake - backStake;
    if (b.wl === "BACK WIN") p = pBack; 
    else if (b.wl === "LAY WIN") p = pLay;
    else if (b.wl === "WIN") p = Math.max(pBack, pLay); 
    else if (b.wl === "LOSS") p = Math.min(pBack, pLay);
  } else if (!hasBack && hasLay) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") p = layStake; else p = -layLiability;
  } else if (hasBack && !hasLay) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") p = backStake * (backOdds - 1); else p = -backStake;
  }
  return p > 0 ? p - kom : p;
}

export async function GET() {
  try {
    // 1. DOLOČI PRETEKLI MESEC
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonthDate.getFullYear();
    const month = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
    const monthLabel = lastMonthDate.toLocaleString('sl-SI', { month: 'long', year: 'numeric' });

    // 2. PREBERI VSE STAVE PRETEKLEGA MESCA
    // Iščemo vse, kjer se datum začne z npr. "2026-01"
    const { data: bets } = await supabase
      .from("bets")
      .select("*")
      .like("datum", `${year}-${month}%`);

    if (!bets || bets.length === 0) return NextResponse.json({ message: "Ni stav za pretekli mesec." });

    // 3. IZRAČUNAJ STATISTIKO
    let totalProfit = 0;
    let totalRisk = 0;
    let wins = 0;
    let losses = 0;

    bets.forEach((b) => {
      const p = calcProfit(b);
      totalProfit += p;
      
      // ROI izračun (risk)
      const backStake = b.vplacilo1 || 0;
      const layLiability = b.vplacilo2 || 0;
      totalRisk += Math.max(backStake, layLiability);

      if (["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)) wins++;
      if (b.wl === "LOSS") losses++;
    });

    const roi = totalRisk > 0 ? (totalProfit / totalRisk) * 100 : 0;
    const emoji = totalProfit >= 0 ? "💰" : "📉";
    const sign = totalProfit > 0 ? "+" : "";

    // 4. SESTAVI POROČILO
    const msg = `<b>${emoji} MESEČNA ANALIZA (${monthLabel.toUpperCase()})</b>\n
💵 <b>Skupni profit: ${sign}${totalProfit.toFixed(2)}€</b>
📈 <b>ROI: ${roi.toFixed(2)}%</b>\n
✅ Zmage: ${wins}
❌ Porazi: ${losses}
📊 Št. stav: ${bets.length}`;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
      });
    }

    return NextResponse.json({ success: true, month: monthLabel });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}