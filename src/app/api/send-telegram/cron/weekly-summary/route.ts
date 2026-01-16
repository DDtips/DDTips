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

function getLastWeekRange(): { startDate: string; endDate: string; weekLabel: string } {
  const now = new Date();
  const slovenianFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Poišči prejšnji ponedeljek (začetek preteklega tedna)
  const today = new Date(slovenianFormatter.format(now));
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Prejšnji ponedeljek = ta ponedeljek - 7 dni
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - diffToMonday - 7);
  
  // Prejšnja nedelja = prejšnji ponedeljek + 6 dni
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);

  const startDate = slovenianFormatter.format(lastMonday);
  const endDate = slovenianFormatter.format(lastSunday);

  // Formatiranje za prikaz (d.m. - d.m.yyyy)
  const formatShort = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
  const formatFull = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  const weekLabel = `${formatShort(lastMonday)} - ${formatFull(lastSunday)}`;

  return { startDate, endDate, weekLabel };
}

// Najboljši tipster tedna
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

// Najboljši šport tedna
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

// Najboljši dan tedna
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
  
  // Formatiraj datum
  const [year, month, day] = best[0].split("-");
  const formattedDate = `${parseInt(day)}.${parseInt(month)}.`;
  
  return { date: formattedDate, profit: best[1] };
}

export async function GET() {
  try {
    const { startDate, endDate, weekLabel } = getLastWeekRange();

    // Pridobi vse stave preteklega tedna
    const { data: bets, error } = await supabase
      .from("bets")
      .select("*")
      .gte("datum", startDate)
      .lte("datum", endDate);

    if (error) throw error;

    if (!bets || bets.length === 0) {
      const msg = `📅 <b>TEDENSKO POROČILO</b>\n🗓️ ${weekLabel}\n\n😴 V preteklem tednu ni bilo nobenih stav.`;
      await sendTelegram(msg);
      return NextResponse.json({ message: "Ni stav za pretekli teden.", week: weekLabel });
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

    // Najboljši tipster, šport in dan
    const bestTipster = getBestTipster(bets);
    const bestSport = getBestSport(bets);
    const bestDay = getBestDay(bets);

    // Emoji indikatorji
    const profitEmoji = totalProfit >= 0 ? "🟢" : "🔴";
    const profitSign = totalProfit >= 0 ? "+" : "";
    const roiEmoji = roi >= 0 ? "🟢" : "🔴";
    const roiSign = roi >= 0 ? "+" : "";

    // Zaključno sporočilo
    let endMessage = "";
    if (totalProfit >= 200) {
      endMessage = "🔥🏆💰 IZJEMEN TEDEN! 💰🏆🔥";
    } else if (totalProfit >= 100) {
      endMessage = "🎉🥇 Odličen teden! 🥇🎉";
    } else if (totalProfit >= 0) {
      endMessage = "✅ Pozitiven teden! 👏";
    } else if (totalProfit >= -50) {
      endMessage = "💪 Naslednji teden bo boljši!";
    } else {
      endMessage = "😤 Težek teden, gremo naprej! 💪";
    }

    // Sestavi sporočilo
    let msg = `📅 <b>TEDENSKO POROČILO</b>
🗓️ <b>${weekLabel}</b>

💰 <b>Finance:</b>
- Profit: ${profitEmoji} <b>${profitSign}${totalProfit.toFixed(2)} €</b>
- Vložek: ${totalStake.toFixed(2)} €
- ROI: ${roiEmoji} <b>${roiSign}${roi.toFixed(1)}%</b>

📈 <b>Statistika:</b>
- Skupaj stav: ${totalBets}
- Dobljene: ${wins} ✅
- Izgubljene: ${losses} ❌${voidBets > 0 ? `\n• Void: ${voidBets} ⚪` : ""}${pending > 0 ? `\n• V teku: ${pending} ⏳` : ""}
- Win rate: ${winRate.toFixed(1)}%`;

    // Dodaj najboljši dan če obstaja in je v plusu
    if (bestDay && bestDay.profit > 0) {
      const daySign = bestDay.profit >= 0 ? "+" : "";
      msg += `\n\n📆 <b>Najboljši dan:</b>\n• ${bestDay.date} → ${daySign}${bestDay.profit.toFixed(2)} €`;
    }

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

    await sendTelegram(msg);

    return NextResponse.json({ 
      success: true, 
      week: weekLabel,
      stats: { totalProfit, roi, totalStake, wins, losses, pending, totalBets, winRate }
    });

  } catch (e: any) {
    console.error("Weekly summary error:", e);
    await sendTelegram(`❌ <b>Napaka pri tedenskem poročilu</b>\n\n${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}