import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

async function sendTelegram(message: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    }),
  });
  return response.ok;
}

function getYesterdayDateString(): string {
  const now = new Date();
  const slovenianFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return slovenianFormatter.format(yesterday);
}

function formatDate(dateStr: string): string {
  // Pretvori 2026-01-15 v 15.01.2026
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

export async function GET() {
  try {
    const dateStr = getYesterdayDateString();

    // Pridobi vse stave za včeraj
    const { data: bets, error } = await supabase
      .from("bets")
      .select("*")
      .eq("datum", dateStr);

    if (error) {
      throw error;
    }

    if (!bets || bets.length === 0) {
      const message = `📊 <b>Dnevno poročilo za ${formatDate(dateStr)}</b>\n\nVčeraj ni bilo nobenih stav.`;
      await sendTelegram(message);
      return NextResponse.json({ 
        success: true, 
        message: "Ni stav za včeraj",
        datum: dateStr 
      });
    }

    // Izračunaj statistiko
    const totalBets = bets.length;
    const wonBets = bets.filter((b) => b.wl === "WIN").length;
    const lostBets = bets.filter((b) => b.wl === "LOSS" || b.wl === "LOSE").length;
    const pendingBets = bets.filter((b) => !b.wl || b.wl === "PENDING" || b.wl === "").length;
    
    // Izračunaj finance
    const totalStake = bets.reduce((sum, b) => sum + (b.vplacilo1 || 0), 0);
    
    // Profit izračun: WIN = (kvota - 1) * vplacilo, LOSS = -vplacilo
    const totalProfit = bets.reduce((sum, b) => {
      if (b.wl === "WIN") {
        return sum + ((b.kvota1 - 1) * b.vplacilo1);
      } else if (b.wl === "LOSS" || b.wl === "LOSE") {
        return sum - b.vplacilo1;
      }
      return sum; // pending - ne šteje
    }, 0);

    // ROI izračun
    const roi = totalStake > 0 ? ((totalProfit / totalStake) * 100).toFixed(1) : "0";

    // Ustvari sporočilo
    const message = `📊 <b>Dnevno poročilo za ${formatDate(dateStr)}</b>

📈 <b>Statistika:</b>
• Skupaj stav: ${totalBets}
• Dobljene: ${wonBets} ✅
• Izgubljene: ${lostBets} ❌
• V teku: ${pendingBets} ⏳

💰 <b>Finance:</b>
• Skupni vložek: ${totalStake.toFixed(2)} €
• Profit: ${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)} €
• ROI: ${roi}%

${totalProfit >= 0 ? "🎉 Odličen dan!" : "💪 Naslednjič bo bolje!"}`;

    const sent = await sendTelegram(message);

    return NextResponse.json({ 
      success: true, 
      telegramSent: sent,
      datum: dateStr,
      stats: { totalBets, wonBets, lostBets, pendingBets, totalStake, totalProfit }
    });

  } catch (e: any) {
    console.error("Daily summary error:", e);
    
    // Pošlji error na Telegram
    await sendTelegram(`❌ <b>Napaka pri dnevnem poročilu</b>\n\n${e.message}`);
    
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}