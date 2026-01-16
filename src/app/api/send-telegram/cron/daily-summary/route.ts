import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inicializacija baze
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Funkcija za profit
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
    // 1. DOLOČI VČERAJŠNJI DATUM (Pravilno glede na časovni pas)
    const options = { timeZone: "Europe/Ljubljana", year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Ljubljana" }); // YYYY-MM-DD
    
    const d = new Date(todayStr);
    d.setDate(d.getDate() - 1); // Odštejemo 1 dan
    
    const dateStr = d.toISOString().split('T')[0]; // Dobimo včeraj v formatu YYYY-MM-DD
    const displayDate = d.toLocaleDateString("sl-SI", { day: 'numeric', month: 'numeric' });

    console.log(`[CRON] Začenjam dnevni povzetek za datum: ${dateStr}`);

    // 2. PREBERI STAVE (Uporabimo ilike, da ulovimo tudi datume s časom)
    const { data: bets, error } = await supabase
      .from("bets")
      .select("*")
      .ilike("datum", `${dateStr}%`);

    if (error) throw error;

    if (!bets || bets.length === 0) {
        console.log(`[CRON] Ni bilo najdenih stav za datum: ${dateStr}`);
        return NextResponse.json({ message: `Ni stav za ${dateStr}.` });
    }

    console.log(`[CRON] Najdenih ${bets.length} stav.`);

    // 3. SEŠTEJ STATISTIKO
    let profit = 0; 
    let wins = 0; 
    let losses = 0;
    
    bets.forEach((b) => {
      profit += calcProfit(b);
      if (["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)) wins++;
      if (b.wl === "LOSS") losses++;
    });

    const emoji = profit >= 0 ? "✅" : "🔻";
    const sign = profit > 0 ? "+" : "";

    // 4. POŠLJI NA TELEGRAM
    const msg = `<b>📊 ANALIZA VČERAJ (${displayDate})</b>\n\n💰 <b>Profit: ${sign}${profit.toFixed(2)}€</b>\n${emoji} W: ${wins} / L: ${losses}\n📊 Skupaj: ${bets.length} stav`;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error("[CRON] Telegram ENV variable manjkajo!");
        return NextResponse.json({ error: "Config missing" }, { status: 500 });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
    });

    const tgData = await tgRes.json();
    console.log("[CRON] Odgovor Telegrama:", tgData);

    return NextResponse.json({ success: true, date: dateStr, count: bets.length });
  } catch (e: any) {
    console.error("[CRON] Napaka:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}