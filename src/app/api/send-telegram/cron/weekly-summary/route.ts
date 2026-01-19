import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// PREPREČI CACHING
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

// Pomnilnik za varno HTML formatiranje
function escapeHTML(str: string): string {
  if (!str) return "";
  return str.replace(/[&<>]/g, (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  }[tag] || tag));
}

// Funkcija za pošiljanje na Telegram
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

// Izračun profita (BACK, LAY, TRADING)
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
  } else if (!hasBack && hasLay) {
    brutoProfit = (b.wl === "WIN" || b.wl === "LAY WIN") ? layStake : -layLiability;
  } else if (hasBack && !hasLay) {
    brutoProfit = (b.wl === "WIN" || b.wl === "BACK WIN") ? backStake * (backOdds - 1) : -backStake;
  }

  return brutoProfit > 0 ? brutoProfit - komZnesek : brutoProfit;
}

// Pridobi razpon prejšnjega tedna (ponedeljek - nedelja)
function getLastWeekRange() {
  const now = new Date();
  const slovenianFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric", month: "2-digit", day: "2-digit",
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

  const weekLabel = `${lastMonday.getDate()}.${lastMonday.getMonth() + 1}. - ${lastSunday.getDate()}.${lastSunday.getMonth() + 1}.${lastSunday.getFullYear()}`;

  return { startDate, endDate, weekLabel };
}

// Pomožne funkcije za statistiko
function getBestTipster(bets: any[]) {
  const stats: Record<string, number> = {};
  bets.forEach(b => { if(b.tipster && b.wl !== "OPEN") stats[b.tipster] = (stats[b.tipster] || 0) + calcProfit(b); });
  const entries = Object.entries(stats);
  return entries.length ? entries.reduce((a, b) => a[1] > b[1] ? a : b) : null;
}

function getBestSport(bets: any[]) {
  const stats: Record<string, number> = {};
  bets.forEach(b => { if(b.sport && b.wl !== "OPEN") stats[b.sport] = (stats[b.sport] || 0) + calcProfit(b); });
  const entries = Object.entries(stats);
  return entries.length ? entries.reduce((a, b) => a[1] > b[1] ? a : b) : null;
}

function getBestDay(bets: any[]) {
  const stats: Record<string, number> = {};
  bets.forEach(b => { if(b.datum && b.wl !== "OPEN") stats[b.datum] = (stats[b.datum] || 0) + calcProfit(b); });
  const entries = Object.entries(stats);
  if (!entries.length) return null;
  const best = entries.reduce((a, b) => a[1] > b[1] ? a : b);
  const [y, m, d] = best[0].split("-");
  return { date: `${parseInt(d)}.${parseInt(m)}.`, profit: best[1] };
}

// GLAVNA FUNKCIJA
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
      await sendTelegram(`📅 <b>TEDENSKO POROČILO</b>\n🗓️ <code>${weekLabel}</code>\n\nBrez stav v preteklem tednu.`);
      return NextResponse.json({ success: true });
    }

    const settled = bets.filter(b => b.wl && b.wl !== "OPEN" && b.wl !== "VOID");
    const wins = bets.filter(b => ["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)).length;
    const losses = bets.filter(b => b.wl === "LOSS").length;
    const totalProfit = settled.reduce((sum, b) => sum + calcProfit(b), 0);
    const totalStake = settled.reduce((sum, b) => sum + Math.max(b.vplacilo1 || 0, b.vplacilo2 || 0), 0);
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;

    const bTipster = getBestTipster(bets);
    const bSport = getBestSport(bets);
    const bDay = getBestDay(bets);

    const divider = "━━━━━━━━━━━━━━";
    const pEmoji = totalProfit >= 0 ? "✅" : "❌";

    // SESTAVLJANJE SPOROČILA
    let msg = `📅 <b>TEDENSKO POROČILO</b>\n`;
    msg += `🗓️ <code>${weekLabel}</code>\n\n`;

    msg += `📊 <b>STATISTIKA</b>\n`;
    msg += `${divider}\n`;
    msg += `• Št. stav: <b>${bets.length}</b>\n`;
    msg += `• Uspešnost: <b>${winRate.toFixed(1)}%</b>\n`;
    msg += `• Izid (W-L): <b>${wins} - ${losses}</b>\n\n`;

    msg += `🌟 <b>NAJBOLJŠE</b>\n`;
    msg += `${divider}\n`;
    if (bDay && bDay.profit > 0) msg += `• Dan: <b>${bDay.date}</b> (<code>+${bDay.profit.toFixed(1)}€</code>)\n`;
    if (bTipster && bTipster[1] > 0) msg += `• Tipster: <b>${escapeHTML(bTipster[0])}</b>\n`;
    if (bSport && bSport[1] > 0) msg += `• Šport: <b>${escapeHTML(bSport[0])}</b>\n\n`;

    msg += `💰 <b>FINANCE</b>\n`;
    msg += `${divider}\n`;
    msg += `• Skupni vložek: <code>${totalStake.toFixed(2)} €</code>\n`;
    msg += `• Donos (ROI): <b>${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%</b>\n\n`;

    // POUDARJEN PROFIT NA DNU
    msg += `${pEmoji} <b>PROFIT:</b> <code>${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)} €</code> ${pEmoji}\n`;
    msg += `${divider}`;

    const sent = await sendTelegram(msg);
    return NextResponse.json({ success: true, telegramSent: sent });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}