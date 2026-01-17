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

function getLastMonthRange(): { year: number; month: string; monthLabel: string; startDate: string; endDate: string } {
  const now = new Date();
  const slovenianFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  const todayParts = slovenianFormatter.formatToParts(now);
  const currentYear = parseInt(todayParts.find(p => p.type === "year")!.value);
  const currentMonth = parseInt(todayParts.find(p => p.type === "month")!.value);
  
  let lastMonth = currentMonth - 1;
  let year = currentYear;
  if (lastMonth === 0) {
    lastMonth = 12;
    year = currentYear - 1;
  }
  
  const month = String(lastMonth).padStart(2, '0');
  
  // Izračunaj zadnji dan meseca
  const lastDay = new Date(year, lastMonth, 0).getDate();
  
  const monthNames = [
    "januar", "februar", "marec", "april", "maj", "junij",
    "julij", "avgust", "september", "oktober", "november", "december"
  ];
  const monthLabel = `${monthNames[lastMonth - 1]} ${year}`;
  
  // Začetek in konec meseca
  const startDate = `${year}-${month}-01`;
  const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  
  return { year, month, monthLabel, startDate, endDate };
}

// Najboljši tipster meseca
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

// Najboljši šport meseca
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

export async function GET() {
  try {
    const { monthLabel, startDate, endDate } = getLastMonthRange();

    console.log("Monthly summary for:", monthLabel, "from", startDate, "to", endDate);

    // Pridobi vse stave preteklega meseca - POPRAVLJEN QUERY!
    const { data: bets, error } = await supabase
      .from("bets")
      .select("*")
      .gte("datum", startDate)
      .lte("datum", endDate);

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    console.log("Bets found:", bets?.length || 0);

    if (!bets || bets.length === 0) {
      const msg = `📊 <b>MESEČNO POROČILO</b>\n🗓️ ${monthLabel.toUpperCase()}\n\n😴 V preteklem mesecu ni bilo nobenih stav.`;
      await sendTelegram(msg);
      return NextResponse.json({ message: "Ni stav za pretekli mesec.", month: monthLabel });
    }

    // Izračunaj statistiko
    const settledBets = bets.filter((b) => b.wl && b.wl !== "OPEN" && b.wl !== "VOID");
    const totalBets = bets.length;
    const wins = bets.filter((b) => ["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)).length;
    const losses = bets.filter((b) => b.wl === "LOSS").length;
    const pending = bets.filter((b) => !b.wl || b.wl === "OPEN").length;
    const voidBets = bets.filter((b) => b.wl === "VOID").length;

    // Finance
    const totalProfit = settledBets.reduce((sum, b) => sum + calcProfit(b), 0);
    const totalStake = settledBets.reduce((sum, b) => {
      const backStake = b.vplacilo1 || 0;
      const layLiability = b.vplacilo2 || 0;
      return sum + Math.max(backStake, layLiability);
    }, 0);
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

    // Win rate
    const winRate = settledBets.length > 0 ? (wins / settledBets.length) * 100 : 0;

    // Najboljši tipster in šport
    const bestTipster = getBestTipster(bets);
    const bestSport = getBestSport(bets);

    // Emoji indikatorji
    const profitEmoji = totalProfit >= 0 ? "🟢" : "🔴";
    const profitSign = totalProfit >= 0 ? "+" : "";
    const roiEmoji = roi >= 0 ? "🟢" : "🔴";
    const roiSign = roi >= 0 ? "+" : "";

    // Zaključno sporočilo
    let endMessage = "";
    if (totalProfit >= 500) {
      endMessage = "🔥🏆💰 IZJEMEN MESEC! 💰🏆🔥";
    } else if (totalProfit >= 200) {
      endMessage = "🎉🥇 Odličen mesec! 🥇🎉";
    } else if (totalProfit >= 0) {
      endMessage = "✅ Pozitiven mesec! 👏";
    } else if (totalProfit >= -100) {
      endMessage = "💪 Naslednji mesec bo boljši!";
    } else {
      endMessage = "😤 Težek mesec, gremo naprej! 💪";
    }

    // Sestavi sporočilo
    let msg = `📊 <b>MESEČNO POROČILO</b>
🗓️ <b>${monthLabel.toUpperCase()}</b>

💰 <b>Finance:</b>
- Profit: ${profitEmoji} <b>${profitSign}${totalProfit.toFixed(2)} €</b>
- Vložek: ${totalStake.toFixed(2)} €
- ROI: ${roiEmoji} <b>${roiSign}${roi.toFixed(1)}%</b>

📈 <b>Statistika:</b>
- Skupaj stav: ${totalBets}
- Dobljene: ${wins} ✅
- Izgubljene: ${losses} ❌${voidBets > 0 ? `\n• Void: ${voidBets} ⚪` : ""}${pending > 0 ? `\n• V teku: ${pending} ⏳` : ""}
- Win rate: ${winRate.toFixed(1)}%`;

    // Dodaj najboljšega tipsterja če obstaja in je v plusu
    if (bestTipster && bestTipster.profit > 0) {
      const tipsterSign = bestTipster.profit >= 0 ? "+" : "";
      msg += `\n\n🏅 <b>Najboljši tipster:</b>\n• ${bestTipster.name}: ${tipsterSign}${bestTipster.profit.toFixed(2)} €`;
    }

    // Dodaj najboljši šport če obstaja in je v plusu
    if (bestSport && bestSport.profit > 0) {
      const sportSign = bestSport.profit >= 0 ? "+" : "";
      msg += `\n\n⚽ <b>Najboljši šport:</b>\n• ${bestSport.name}: ${sportSign}${bestSport.profit.toFixed(2)} €`;
    }

    msg += `\n\n${endMessage}`;

    console.log("Sending monthly summary to Telegram");
    const sent = await sendTelegram(msg);
    console.log("Telegram sent:", sent);

    return NextResponse.json({ 
      success: true, 
      telegramSent: sent,
      month: monthLabel,
      stats: { totalProfit, roi, totalStake, wins, losses, pending, totalBets, winRate }
    });

  } catch (e: any) {
    console.error("Monthly summary error:", e);
    await sendTelegram(`❌ <b>Napaka pri mesečnem poročilu</b>\n\n${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}