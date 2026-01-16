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

function getLastMonthRange(): { year: number; month: string; monthLabel: string } {
  // Uporabi slovenski časovni pas
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
  
  // Izračunaj pretekli mesec
  let lastMonth = currentMonth - 1;
  let year = currentYear;
  if (lastMonth === 0) {
    lastMonth = 12;
    year = currentYear - 1;
  }
  
  const month = String(lastMonth).padStart(2, '0');
  
  // Slovenski naziv meseca
  const monthNames = [
    "januar", "februar", "marec", "april", "maj", "junij",
    "julij", "avgust", "september", "oktober", "november", "december"
  ];
  const monthLabel = `${monthNames[lastMonth - 1]} ${year}`;
  
  return { year, month, monthLabel };
}

export async function GET() {
  try {
    // 1. DOLOČI PRETEKLI MESEC
    const { year, month, monthLabel } = getLastMonthRange();

    // 2. PREBERI VSE STAVE PRETEKLEGA MESECA
    const { data: bets, error } = await supabase
      .from("bets")
      .select("*")
      .like("datum", `${year}-${month}%`);

    if (error) throw error;

    if (!bets || bets.length === 0) {
      const msg = `📊 <b>MESEČNO POROČILO (${monthLabel.toUpperCase()})</b>\n\nV preteklem mesecu ni bilo nobenih stav.`;
      
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (token && chatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
        });
      }
      return NextResponse.json({ message: "Ni stav za pretekli mesec.", month: monthLabel });
    }

    // 3. IZRAČUNAJ STATISTIKO
    let totalProfit = 0;
    let totalRisk = 0;
    let wins = 0;
    let losses = 0;
    let pending = 0;

    bets.forEach((b) => {
      const p = calcProfit(b);
      totalProfit += p;
      
      // ROI izračun (risk)
      const backStake = b.vplacilo1 || 0;
      const layLiability = b.vplacilo2 || 0;
      totalRisk += Math.max(backStake, layLiability);

      if (["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)) wins++;
      else if (b.wl === "LOSS") losses++;
      else if (b.wl === "OPEN" || !b.wl) pending++;
    });

    const roi = totalRisk > 0 ? (totalProfit / totalRisk) * 100 : 0;
    
    // Barvni indikatorji
    const profitEmoji = totalProfit >= 0 ? "🟢" : "🔴";
    const roiEmoji = roi >= 0 ? "🟢" : "🔴";
    const headerEmoji = totalProfit >= 0 ? "💰" : "📉";
    const sign = totalProfit >= 0 ? "+" : "";
    const roiSign = roi >= 0 ? "+" : "";

    // 4. SESTAVI POROČILO
    const msg = `${headerEmoji} <b>MESEČNO POROČILO (${monthLabel.toUpperCase()})</b>

💵 <b>Skupni profit:</b> ${profitEmoji} <b>${sign}${totalProfit.toFixed(2)} €</b>
📈 <b>ROI:</b> ${roiEmoji} <b>${roiSign}${roi.toFixed(2)}%</b>
💸 <b>Skupni vložek:</b> ${totalRisk.toFixed(2)} €

📊 <b>Statistika:</b>
• Skupaj stav: ${bets.length}
• Dobljene: ${wins} ✅
• Izgubljene: ${losses} ❌
• V teku: ${pending} ⏳

${totalProfit >= 0 ? "🎉 Odličen mesec!" : "💪 Naslednji mesec bo boljši!"}`;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
      });
    }

    return NextResponse.json({ 
      success: true, 
      month: monthLabel,
      stats: { totalProfit, roi, totalRisk, wins, losses, pending, totalBets: bets.length }
    });
  } catch (e: any) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chat_id: chatId, 
          text: `❌ <b>Napaka pri mesečnem poročilu</b>\n\n${e.message}`, 
          parse_mode: "HTML" 
        }),
      });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}