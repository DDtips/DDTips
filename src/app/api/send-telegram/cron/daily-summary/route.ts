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
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day)}.${parseInt(month)}.`;
}

// Izračun profita za stavo (upošteva BACK, LAY, TRADING)
function calcProfit(b: any): number {
  if (b.wl === "OPEN" || b.wl === "VOID" || !b.wl) return 0;

  const komZnesek = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0;
  const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0;
  const layOdds = b.lay_kvota || 0;
  
  const hasBack = backOdds > 1 && backStake > 0;
  const hasLay = layOdds > 1 && layLiability > 0;
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;

  let brutoProfit = 0;

  if (hasBack && hasLay) {
    const profitIfBackWins = (backStake * (backOdds - 1)) - layLiability;
    const profitIfLayWins = layStake - backStake;

    if (b.wl === "BACK WIN") brutoProfit = profitIfBackWins;
    else if (b.wl === "LAY WIN") brutoProfit = profitIfLayWins;
    else if (b.wl === "WIN") brutoProfit = Math.max(profitIfBackWins, profitIfLayWins);
    else if (b.wl === "LOSS") brutoProfit = Math.min(profitIfBackWins, profitIfLayWins);
  }
  else if (!hasBack && hasLay) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") brutoProfit = layStake;
    else if (b.wl === "LOSS" || b.wl === "BACK WIN") brutoProfit = -layLiability;
  }
  else if (hasBack && !hasLay) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") brutoProfit = backStake * (backOdds - 1);
    else if (b.wl === "LOSS" || b.wl === "LAY WIN") brutoProfit = -backStake;
  }

  if (brutoProfit > 0) {
    return brutoProfit - komZnesek;
  }
  return brutoProfit;
}

// Pridobi začetek tedna (ponedeljek)
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split("T")[0];
}

// Pridobi začetek meseca
function getMonthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

export async function GET() {
  try {
    const dateStr = getYesterdayDateString();
    const weekStart = getWeekStart(dateStr);
    const monthStart = getMonthStart(dateStr);

    // Pridobi vse stave za včeraj
    const { data: bets, error } = await supabase
      .from("bets")
      .select("*")
      .eq("datum", dateStr);

    if (error) throw error;

    // Pridobi stave za teden
    const { data: weekBets, error: weekError } = await supabase
      .from("bets")
      .select("*")
      .gte("datum", weekStart)
      .lte("datum", dateStr);

    if (weekError) throw weekError;

    // Pridobi stave za mesec
    const { data: monthBets, error: monthError } = await supabase
      .from("bets")
      .select("*")
      .gte("datum", monthStart)
      .lte("datum", dateStr);

    if (monthError) throw monthError;

    if (!bets || bets.length === 0) {
      // Izračunaj tedenski in mesečni profit tudi če včeraj ni bilo stav
      const weekSettled = (weekBets || []).filter((b) => b.wl && b.wl !== "OPEN" && b.wl !== "VOID");
      const monthSettled = (monthBets || []).filter((b) => b.wl && b.wl !== "OPEN" && b.wl !== "VOID");
      
      const weekProfit = weekSettled.reduce((sum, b) => sum + calcProfit(b), 0);
      const monthProfit = monthSettled.reduce((sum, b) => sum + calcProfit(b), 0);
      
      const weekEmoji = weekProfit >= 0 ? "🟢" : "🔴";
      const weekSign = weekProfit >= 0 ? "+" : "";
      const monthEmoji = monthProfit >= 0 ? "🟢" : "🔴";
      const monthSign = monthProfit >= 0 ? "+" : "";

      const message = `📊 <b>Dnevno poročilo za ${formatDate(dateStr)}</b>

😴 Včeraj ni bilo nobenih stav.

📅 <b>Pregled obdobja:</b>
- Teden: ${weekEmoji} <b>${weekSign}${weekProfit.toFixed(2)} €</b>
- Mesec: ${monthEmoji} <b>${monthSign}${monthProfit.toFixed(2)} €</b>`;

      await sendTelegram(message);
      return NextResponse.json({ 
        success: true, 
        message: "Ni stav za včeraj",
        datum: dateStr 
      });
    }

    // Izračunaj statistiko za včeraj
    const totalBets = bets.length;
    const wonBets = bets.filter((b) => ["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)).length;
    const lostBets = bets.filter((b) => b.wl === "LOSS").length;
    const pendingBets = bets.filter((b) => !b.wl || b.wl === "OPEN").length;
    const voidBets = bets.filter((b) => b.wl === "VOID").length;
    
    // Izračunaj finance za včeraj
    const totalStake = bets.reduce((sum, b) => sum + (b.vplacilo1 || 0) + (b.vplacilo2 || 0), 0);
    const settledBets = bets.filter((b) => b.wl && b.wl !== "OPEN" && b.wl !== "VOID");
    const totalProfit = settledBets.reduce((sum, b) => sum + calcProfit(b), 0);

    // Izračunaj tedenski in mesečni profit
    const weekSettled = (weekBets || []).filter((b) => b.wl && b.wl !== "OPEN" && b.wl !== "VOID");
    const monthSettled = (monthBets || []).filter((b) => b.wl && b.wl !== "OPEN" && b.wl !== "VOID");
    
    const weekProfit = weekSettled.reduce((sum, b) => sum + calcProfit(b), 0);
    const monthProfit = monthSettled.reduce((sum, b) => sum + calcProfit(b), 0);

    // ROI izračun
    const settledStake = settledBets.reduce((sum, b) => sum + (b.vplacilo1 || 0), 0);
    const roi = settledStake > 0 ? ((totalProfit / settledStake) * 100).toFixed(1) : "0";

    // Emoji indikatorji
    const profitEmoji = totalProfit >= 0 ? "🟢" : "🔴";
    const profitSign = totalProfit >= 0 ? "+" : "";
    const roiEmoji = parseFloat(roi) >= 0 ? "🟢" : "🔴";
    const roiSign = parseFloat(roi) >= 0 ? "+" : "";
    const weekEmoji = weekProfit >= 0 ? "🟢" : "🔴";
    const weekSign = weekProfit >= 0 ? "+" : "";
    const monthEmoji = monthProfit >= 0 ? "🟢" : "🔴";
    const monthSign = monthProfit >= 0 ? "+" : "";

    // Izberi zaključno sporočilo glede na rezultat
    let endMessage = "";
    if (totalProfit >= 100) {
      endMessage = "🔥🎉💰 IZJEMEN DAN! 💰🎉🔥";
    } else if (totalProfit >= 50) {
      endMessage = "🎉✨ Odličen dan! ✨🎉";
    } else if (totalProfit >= 0) {
      endMessage = "✅ Pozitiven dan! 👍";
    } else if (totalProfit >= -50) {
      endMessage = "💪 Naslednjič bo bolje!";
    } else {
      endMessage = "😤 Težek dan, gremo naprej! 💪";
    }

    // Ustvari sporočilo
    const message = `📊 <b>Dnevno poročilo za ${formatDate(dateStr)}</b>

📈 <b>Statistika:</b>
- Skupaj stav: ${totalBets}
- Dobljene: ${wonBets} ✅
- Izgubljene: ${lostBets} ❌${voidBets > 0 ? `\n• Void: ${voidBets} ⚪` : ""}${pendingBets > 0 ? `\n• V teku: ${pendingBets} ⏳` : ""}

💰 <b>Dnevni profit:</b>
- Vložek: ${totalStake.toFixed(2)} €
- Profit: ${profitEmoji} <b>${profitSign}${totalProfit.toFixed(2)} €</b>
- ROI: ${roiEmoji} <b>${roiSign}${roi}%</b>

📅 <b>Pregled obdobja:</b>
- Teden: ${weekEmoji} <b>${weekSign}${weekProfit.toFixed(2)} €</b>
- Mesec: ${monthEmoji} <b>${monthSign}${monthProfit.toFixed(2)} €</b>

${endMessage}`;

    const sent = await sendTelegram(message);

    return NextResponse.json({ 
      success: true, 
      telegramSent: sent,
      datum: dateStr,
      stats: { totalBets, wonBets, lostBets, pendingBets, totalStake, totalProfit, weekProfit, monthProfit }
    });

  } catch (e: any) {
    console.error("Daily summary error:", e);
    await sendTelegram(`❌ <b>Napaka pri dnevnem poročilu</b>\n\n${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}