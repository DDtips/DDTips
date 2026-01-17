import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// PREPREČI CACHING - Zagotovi, da Vercel vsakič dejansko izvede kodo
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

// Funkcija za preprečevanje napak pri Telegram HTML formatiranju
function escapeHTML(str: string): string {
  if (!str) return "";
  return str.replace(/[&<>]/g, (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  }[tag] || tag));
}

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

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Telegram API Error:", errorData);
  }
  
  return response.ok;
}

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

  return brutoProfit > 0 ? brutoProfit - komZnesek : brutoProfit;
}

function getLastWeekRange(): { startDate: string; endDate: string; weekLabel: string } {
  const now = new Date();
  const slovenianFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const today = new Date(slovenianFormatter.format(now));
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - diffToMonday - 7);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);

  const startDate = slovenianFormatter.format(lastMonday);
  const endDate = slovenianFormatter.format(lastSunday);

  const formatShort = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
  const formatFull = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  const weekLabel = `${formatShort(lastMonday)} - ${formatFull(lastSunday)}`;

  return { startDate, endDate, weekLabel };
}

function getBestTipster(bets: any[]): { name: string; profit: number } | null {
  const tipsterProfits: Record<string, number> = {};
  bets.forEach((b) => {
    if (b.wl && b.wl !== "OPEN" && b.wl !== "VOID" && b.tipster) {
      const profit = calcProfit(b);
      tipsterProfits[b.tipster] = (tipsterProfits[b.tipster] || 0) + profit;
    }
  });
  const entries = Object.entries(tipsterProfits);
  if (entries.length === 0) return null;
  const best = entries.reduce((a, b) => a[1] > b[1] ? a : b);
  return { name: best[0], profit: best[1] };
}

function getBestSport(bets: any[]): { name: string; profit: number } | null {
  const sportProfits: Record<string, number> = {};
  bets.forEach((b) => {
    if (b.wl && b.wl !== "OPEN" && b.wl !== "VOID" && b.sport) {
      const profit = calcProfit(b);
      sportProfits[b.sport] = (sportProfits[b.sport] || 0) + profit;
    }
  });
  const entries = Object.entries(sportProfits);
  if (entries.length === 0) return null;
  const best = entries.reduce((a, b) => a[1] > b[1] ? a : b);
  return { name: best[0], profit: best[1] };
}

function getBestDay(bets: any[]): { date: string; profit: number } | null {
  const dayProfits: Record<string, number> = {};
  bets.forEach((b) => {
    if (b.wl && b.wl !== "OPEN" && b.wl !== "VOID" && b.datum) {
      const profit = calcProfit(b);
      dayProfits[b.datum] = (dayProfits[b.datum] || 0) + profit;
    }
  });
  const entries = Object.entries(dayProfits);
  if (entries.length === 0) return null;
  const best = entries.reduce((a, b) => a[1] > b[1] ? a : b);
  const [year, month, day] = best[0].split("-");
  return { date: `${parseInt(day)}.${parseInt(month)}.`, profit: best[1] };
}

export async function GET() {
  try {
    const { startDate, endDate, weekLabel } = getLastWeekRange();

    const { data: bets, error } = await supabase
      .from("bets")
      .select("*")
      .gte("datum", startDate)
      .lte("datum", endDate);

    if (error) throw error;

    if (!bets || bets.length === 0) {
      const emptyMsg = `📅 <b>TEDENSKO POROČILO</b>\n🗓️ ${weekLabel}\n\n😴 V preteklem tednu ni bilo nobenih stav.`;
      await sendTelegram(emptyMsg);
      return NextResponse.json({ success: true, message: "Ni stav." });
    }

    const settledBets = bets.filter((b) => b.wl && b.wl !== "OPEN" && b.wl !== "VOID");
    const totalBets = bets.length;
    const wins = bets.filter((b) => ["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)).length;
    const losses = bets.filter((b) => b.wl === "LOSS").length;
    const voidBets = bets.filter((b) => b.wl === "VOID").length;
    const pending = bets.filter((b) => !b.wl || b.wl === "OPEN").length;

    const totalProfit = settledBets.reduce((sum, b) => sum + calcProfit(b), 0);
    const totalStake = settledBets.reduce((sum, b) => sum + Math.max(b.vplacilo1 || 0, b.vplacilo2 || 0), 0);
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    const winRate = settledBets.length > 0 ? (wins / settledBets.length) * 100 : 0;

    const bestTipster = getBestTipster(bets);
    const bestSport = getBestSport(bets);
    const bestDay = getBestDay(bets);

    let msg = `📅 <b>TEDENSKO POROČILO</b>
🗓️ <b>${weekLabel}</b>

💰 <b>Finance:</b>
- Profit: ${totalProfit >= 0 ? "🟢" : "🔴"} <b>${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)} €</b>
- Vložek: ${totalStake.toFixed(2)} €
- ROI: ${roi >= 0 ? "🟢" : "🔴"} <b>${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%</b>

📈 <b>Statistika:</b>
- Skupaj stav: ${totalBets}
- Dobljene: ${wins} ✅
- Izgubljene: ${losses} ❌${voidBets > 0 ? `\n- Void: ${voidBets} ⚪` : ""}${pending > 0 ? `\n- V teku: ${pending} ⏳` : ""}
- Win rate: ${winRate.toFixed(1)}%`;

    if (bestDay && bestDay.profit > 0) {
      msg += `\n\n📆 <b>Najboljši dan:</b>\n• ${bestDay.date} → +${bestDay.profit.toFixed(2)} €`;
    }

    if (bestTipster && bestTipster.profit > 0) {
      msg += `\n\n🏅 <b>Najboljši tipster:</b>\n• ${escapeHTML(bestTipster.name)}: +${bestTipster.profit.toFixed(2)} €`;
    }

    if (bestSport && bestSport.profit > 0) {
      msg += `\n\n⚽ <b>Najboljši šport:</b>\n• ${escapeHTML(bestSport.name)}: +${bestSport.profit.toFixed(2)} €`;
    }

    msg += `\n\n${totalProfit >= 0 ? "✅ Pozitiven teden! 👏" : "😤 Težek teden, gremo naprej! 💪"}`;

    const sent = await sendTelegram(msg);

    return NextResponse.json({ 
      success: true, 
      telegramSent: sent, 
      week: weekLabel,
      stats: { totalProfit, totalBets, winRate } 
    });

  } catch (e: any) {
    console.error("Critical Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}