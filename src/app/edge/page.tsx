"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, ReferenceLine
} from "recharts";
import {
  Crosshair, AlertTriangle, TrendingDown, TrendingUp, Zap, CalendarDays,
  Loader2, Radar, ShieldAlert, Skull, Trophy, Layers, Target, Clock, Coins, X,
  Activity, Brain, Filter, Sparkles, Info, Flame
} from "lucide-react";

// --- TIPOVI ---
type WL = "OPEN" | "WIN" | "LOSS" | "VOID" | "BACK WIN" | "LAY WIN";
type Bet = {
  id: string; datum: string; wl: WL; kvota1: number; vplacilo1: number;
  lay_kvota: number; vplacilo2: number; komisija: number; sport: string;
  tipster: string; cas_stave: string; dogodek?: string; tip?: string; stavnica?: string;
  mode?: string;
  created_by?: string;
};
type TimeFilter = "7d" | "30d" | "90d" | "all";

// --- POMOŽNE FUNKCIJE ---
function eur(n: number) {
  return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function eurDec(n: number) {
  return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function hasLay(b: Bet) { return Number(b.lay_kvota ?? 0) > 1 && Number(b.vplacilo2 ?? 0) > 0; }
function hasBack(b: Bet) { return Number(b.kvota1 ?? 0) > 1 && Number(b.vplacilo1 ?? 0) > 0; }

function calcProfit(b: Bet): number {
  if (!b || b.wl === "OPEN" || b.wl === "VOID" || !b.wl) return 0;
  const komZnesek = Number(b.komisija ?? 0);
  const backStake = Number(b.vplacilo1 ?? 0); const backOdds = Number(b.kvota1 ?? 0);
  const layLiability = Number(b.vplacilo2 ?? 0); const layOdds = Number(b.lay_kvota ?? 0);
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;

  let brutoProfit = 0;
  if (hasBack(b) && hasLay(b)) {
    const pBW = (backStake * (backOdds - 1)) - layLiability;
    const pLW = layStake - backStake;
    if (b.wl === "BACK WIN") brutoProfit = pBW;
    else if (b.wl === "LAY WIN") brutoProfit = pLW;
    else if (b.wl === "WIN") brutoProfit = Math.max(pBW, pLW);
    else if (b.wl === "LOSS") brutoProfit = Math.min(pBW, pLW);
  } else if (!hasBack(b) && hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") brutoProfit = layStake;
    else if (b.wl === "LOSS" || b.wl === "BACK WIN") brutoProfit = -layLiability;
  } else if (hasBack(b) && !hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") brutoProfit = backStake * (backOdds - 1);
    else if (b.wl === "LOSS" || b.wl === "LAY WIN") brutoProfit = -backStake;
  }
  return brutoProfit > 0 ? brutoProfit - komZnesek : brutoProfit;
}

function calcRisk(b: Bet): number {
  const backStake = Number(b.vplacilo1 ?? 0);
  const layLiability = Number(b.vplacilo2 ?? 0);
  if (hasBack(b) && !hasLay(b)) return backStake;
  if (!hasBack(b) && hasLay(b)) return layLiability;
  if (hasBack(b) && hasLay(b)) return Math.max(backStake, layLiability);
  return 0;
}

function getEffectiveOdds(b: Bet): number {
  const back = Number(b.kvota1 ?? 0);
  const lay = Number(b.lay_kvota ?? 0);
  if (back > 1) return back;
  if (lay > 1) return lay;
  return 0;
}

// Standardni odklon
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#121214]/95 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-xl">
        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">{label}</p>
        <div className="flex flex-col gap-1">
          <span className={`text-sm font-mono font-black ${data.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            Profit: {data.profit > 0 ? '+' : ''}{eur(data.profit)}
          </span>
          <span className="text-xs text-zinc-400 font-medium">Št. stav: {data.count}</span>
          {data.roi !== undefined && (
            <span className={`text-xs font-bold ${data.roi >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              ROI: {data.roi > 0 ? '+' : ''}{data.roi.toFixed(1)}%
            </span>
          )}
          <span className="text-[9px] text-violet-400 mt-1 uppercase tracking-widest animate-pulse">Klikni za podrobnosti</span>
        </div>
      </div>
    );
  }
  return null;
};

// --- GLAVNA KOMPONENTA ---
export default function EdgePage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalData, setModalData] = useState<{ title: string, bets: Bet[] } | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  useEffect(() => {
    const fetchBets = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      
      // PREVERJANJE DOSTOPA (identično kot na Bets strani)
      const { data: profile } = await supabase.from('profiles').select('is_approved').eq('id', user.id).single();
      if (user.email !== "skolnik.dejan40@gmail.com" && (!profile || !profile.is_approved)) { 
        router.replace("/pending"); 
        return; 
      }

      // PRENOS STAV (brez user_id filtra, identično kot Bets stran)
      const { data } = await supabase
        .from("bets")
        .select("*")
        .order("datum", { ascending: true }); // Tukaj obvezno ascending za pravilen graf!
        
      if (data) setRows(data as Bet[]);
      setLoading(false);
    };
    fetchBets();
  }, [router]);

  // Escape za zapiranje modala + lock scroll
  useEffect(() => {
    if (!modalData) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setModalData(null); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [modalData]);

  // Filter po obdobju
  const filteredRows = useMemo(() => {
    if (timeFilter === "all") return rows;
    const now = Date.now();
    const days = timeFilter === "7d" ? 7 : timeFilter === "30d" ? 30 : 90;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return rows.filter(r => {
      const t = new Date(r.datum).getTime();
      return !isNaN(t) && t >= cutoff;
    });
  }, [rows, timeFilter]);

  const analytics = useMemo(() => {
    const validRows = filteredRows.filter(r => r && r.wl);
    const settled = validRows.filter(r => r.wl !== "OPEN" && r.wl !== "VOID");
    const openBets = validRows.filter(r => r.wl === "OPEN");

    const exposure = openBets.reduce((acc, r) => acc + calcRisk(r), 0);
    const potentialProfit = openBets.reduce((acc, r) => {
      const risk = calcRisk(r);
      const odds = getEffectiveOdds(r);
      return acc + (risk * (odds > 1 ? odds - 1 : 0));
    }, 0);

    // POPRAVEK: VOID stave NE resetirajo streaka
    let currentWin = 0, maxWin = 0, currentLoss = 0, maxLoss = 0;
    settled.forEach(b => {
      const isWin = ["WIN", "BACK WIN", "LAY WIN"].includes(b.wl);
      const isLoss = b.wl === "LOSS";
      if (isWin) { currentWin++; currentLoss = 0; maxWin = Math.max(maxWin, currentWin); }
      else if (isLoss) { currentLoss++; currentWin = 0; maxLoss = Math.max(maxLoss, currentLoss); }
      // Ostalo (npr. nedoločeno) - ohrani streak
    });

    // Vse v enem prehodu - performance optimizacija
    const oddsBrackets = [
      { name: '< 1.50', min: 0, max: 1.499, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] },
      { name: '1.50-1.99', min: 1.50, max: 1.999, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] },
      { name: '2.00-2.99', min: 2.00, max: 2.999, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] },
      { name: '3.00+', min: 3.00, max: 9999, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] }
    ];

    const stakeBrackets = [
      { name: '< 30€', min: 0, max: 29.99, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] },
      { name: '30-60€', min: 30, max: 59.99, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] },
      { name: '60-100€', min: 60, max: 99.99, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] },
      { name: '100€+', min: 100, max: 99999, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] }
    ];

    // Pon=0, Tor=1, ..., Ned=6
    const dayNames = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];
    const daysData = dayNames.map(day => ({ name: day, profit: 0, count: 0, bets: [] as Bet[], roi: 0, risk: 0 }));

    let prematch = { profit: 0, risk: 0, count: 0, roi: 0 };
    let live = { profit: 0, risk: 0, count: 0, roi: 0 };

    const comboMap = new Map<string, any>();
    const sportMap = new Map<string, any>();
    const tipsterMap = new Map<string, any>();

    let totalProfit = 0;
    let totalRisk = 0;
    let wins = 0, losses = 0;
    const profitsArr: number[] = [];

    // En sam prehod čez settled stave
    settled.forEach(b => {
      const p = calcProfit(b);
      const r = calcRisk(b);
      const odds = getEffectiveOdds(b);
      const isWin = ["WIN", "BACK WIN", "LAY WIN"].includes(b.wl);
      const isLoss = b.wl === "LOSS";

      totalProfit += p;
      totalRisk += r;
      profitsArr.push(p);
      if (isWin) wins++;
      if (isLoss) losses++;

      if (b.cas_stave === "PREMATCH") { prematch.profit += p; prematch.risk += r; prematch.count++; }
      else if (b.cas_stave === "LIVE") { live.profit += p; live.risk += r; live.count++; }

      if (odds > 0) {
        const br = oddsBrackets.find(br => odds >= br.min && odds <= br.max);
        if (br) { br.profit += p; br.risk += r; br.count++; br.bets.push(b); }
      }

      const stBr = stakeBrackets.find(br => r >= br.min && r <= br.max);
      if (stBr) { stBr.profit += p; stBr.risk += r; stBr.count++; stBr.bets.push(b); }

      if (b.datum) {
        const dateObj = new Date(b.datum);
        if (!isNaN(dateObj.getTime())) {
          // getDay(): 0=Ned, 1=Pon ... mapping na 0=Pon, 6=Ned
          const jsDay = dateObj.getDay();
          const idx = jsDay === 0 ? 6 : jsDay - 1;
          if (daysData[idx]) {
            daysData[idx].profit += p;
            daysData[idx].risk += r;
            daysData[idx].count++;
            daysData[idx].bets.push(b);
          }
        }
      }

      const sKey = b.sport || "OSTALO";
      const tKey = b.tipster || "NEZNANO";
      const cKey = `${tKey} • ${sKey}`;

      if (!sportMap.has(sKey)) sportMap.set(sKey, { name: sKey, profit: 0, risk: 0, count: 0, wins: 0, bets: [] as Bet[] });
      if (!tipsterMap.has(tKey)) tipsterMap.set(tKey, { name: tKey, profit: 0, risk: 0, count: 0, wins: 0, bets: [] as Bet[] });
      if (!comboMap.has(cKey)) comboMap.set(cKey, { name: cKey, profit: 0, risk: 0, count: 0, wins: 0 });

      const sObj = sportMap.get(sKey); sObj.profit += p; sObj.risk += r; sObj.count++; if (isWin) sObj.wins++; sObj.bets.push(b);
      const tObj = tipsterMap.get(tKey); tObj.profit += p; tObj.risk += r; tObj.count++; if (isWin) tObj.wins++; tObj.bets.push(b);
      const cObj = comboMap.get(cKey); cObj.profit += p; cObj.risk += r; cObj.count++; if (isWin) cObj.wins++;
    });

    const calcRoi = (profit: number, risk: number) => risk > 0 ? (profit / risk) * 100 : 0;

    prematch.roi = calcRoi(prematch.profit, prematch.risk);
    live.roi = calcRoi(live.profit, live.risk);
    stakeBrackets.forEach(b => b.roi = calcRoi(b.profit, b.risk));
    oddsBrackets.forEach(b => b.roi = calcRoi(b.profit, b.risk));
    daysData.forEach(d => d.roi = calcRoi(d.profit, d.risk));

    // Top/Toxic combos - brez prekrivanja
    const validCombos = Array.from(comboMap.values())
      .map(c => ({ ...c, roi: calcRoi(c.profit, c.risk) }))
      .filter(c => c.count >= 5);

    const sortedByProfit = [...validCombos].sort((a, b) => b.profit - a.profit);
    const topCombos = sortedByProfit.filter(c => c.profit > 0).slice(0, 4);
    const topNames = new Set(topCombos.map(c => c.name));
    const toxicCombos = sortedByProfit
      .filter(c => c.profit < 0 && !topNames.has(c.name))
      .reverse()
      .slice(0, 4);

    const sportsList = Array.from(sportMap.values())
      .map(s => ({ ...s, roi: calcRoi(s.profit, s.risk), winRate: s.count > 0 ? (s.wins / s.count) * 100 : 0 }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.roi - a.roi);

    const tipstersList = Array.from(tipsterMap.values())
      .map(t => ({ ...t, roi: calcRoi(t.profit, t.risk), winRate: t.count > 0 ? (t.wins / t.count) * 100 : 0 }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.roi - a.roi);

    // STATISTIČNE METRIKE
    const totalRoi = calcRoi(totalProfit, totalRisk);
    const winRate = settled.length > 0 ? (wins / (wins + losses || 1)) * 100 : 0;
    const avgProfit = settled.length > 0 ? totalProfit / settled.length : 0;
    const sd = stdDev(profitsArr);
    const sharpe = sd > 0 ? avgProfit / sd : 0;

    // Cumulative profit za graf
    let cumulative = 0;
    const cumulativeData = settled.map((b, i) => {
      cumulative += calcProfit(b);
      return { idx: i + 1, profit: cumulative, date: b.datum };
    });

    // Drawdown analiza
    let peak = 0, maxDrawdown = 0;
    cumulativeData.forEach(d => {
      if (d.profit > peak) peak = d.profit;
      const dd = peak - d.profit;
      if (dd > maxDrawdown) maxDrawdown = dd;
    });

    // TILT DETECTOR: po 3+ izgubah - ali se vložki povečajo?
    let tiltDetected = false;
    let avgStakeNormal = 0;
    let avgStakeAfterLoss = 0;
    let normalCount = 0, tiltCount = 0;
    let lossStreak = 0;

    settled.forEach(b => {
      const r = calcRisk(b);
      if (lossStreak >= 3) {
        avgStakeAfterLoss += r;
        tiltCount++;
      } else {
        avgStakeNormal += r;
        normalCount++;
      }
      if (b.wl === "LOSS") lossStreak++;
      else if (["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)) lossStreak = 0;
    });

    if (normalCount > 0 && tiltCount > 0) {
      avgStakeNormal /= normalCount;
      avgStakeAfterLoss /= tiltCount;
      tiltDetected = avgStakeAfterLoss > avgStakeNormal * 1.2;
    }

    // Avg odds
    const avgOdds = settled.length > 0
      ? settled.reduce((acc, b) => acc + getEffectiveOdds(b), 0) / settled.length
      : 0;

    return {
      exposure, openCount: openBets.length, potentialProfit, maxWin, maxLoss,
      oddsBrackets, daysData, stakeBrackets, prematch, live,
      topCombos, toxicCombos, sportsList, tipstersList,
      totalProfit, totalRoi, winRate, avgProfit, sharpe, sd,
      cumulativeData, maxDrawdown, settledCount: settled.length,
      tiltDetected, avgStakeNormal, avgStakeAfterLoss, avgOdds
    };
  }, [filteredRows]);

  const openModal = useCallback((title: string, bets: Bet[]) => {
    setModalData({ title, bets: bets || [] });
  }, []);

  // LOADING SKELETON
  if (loading) {
    return (
      <main className="min-h-screen bg-[#050508] text-white pb-24">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 pt-44 pb-12">
          <div className="mb-10 border-b border-white/5 pb-8">
            <div className="h-4 w-32 bg-white/5 rounded mb-3 animate-pulse" />
            <div className="h-12 w-80 bg-white/5 rounded mb-3 animate-pulse" />
            <div className="h-4 w-96 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[#18181b]/50 border border-white/5 rounded-[2rem] p-8 h-48 animate-pulse">
                <div className="h-4 w-24 bg-white/5 rounded mb-6" />
                <div className="h-10 w-32 bg-white/5 rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="bg-[#18181b]/50 border border-white/5 rounded-[2.5rem] p-8 h-80 animate-pulse" />
            ))}
          </div>
          <div className="flex items-center justify-center gap-3 mt-12 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs uppercase tracking-widest font-bold">Nalaganje analitike...</span>
          </div>
        </div>
      </main>
    );
  }

  // EMPTY STATE
  if (rows.length === 0) {
    return (
      <main className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="inline-flex p-5 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-6">
            <Radar className="w-10 h-10 text-violet-400" />
          </div>
          <h2 className="text-3xl font-black tracking-tighter mb-3">Še ni podatkov</h2>
          <p className="text-zinc-500 text-sm mb-8 font-medium leading-relaxed">
            Za analizo "edge-a" potrebujemo vsaj nekaj zaključenih stav. Dodaj svojo prvo stavo in se vrni nazaj.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-violet-500 hover:bg-violet-600 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors"
          >
            Dodaj prvo stavo
          </button>
        </div>
      </main>
    );
  }

  const filterButtons: { key: TimeFilter; label: string }[] = [
    { key: "7d", label: "7 dni" },
    { key: "30d", label: "30 dni" },
    { key: "90d", label: "90 dni" },
    { key: "all", label: "Vse" },
  ];

  return (
    <main className="min-h-screen bg-[#050508] text-white antialiased selection:bg-violet-500/30 pb-24">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-950/20 via-transparent to-transparent" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-8 pt-44 pb-12 z-10">

        {/* HEADER + FILTER */}
        <div className="mb-10 border-b border-white/5 pb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <Radar className="w-5 h-5 text-violet-400" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Deep Analytics</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white">
                Finding the <span className="text-violet-500">Edge</span>
              </h2>
              <p className="text-zinc-500 text-sm mt-3 font-medium">
                Analiza matematičnih vzorcev, tveganja in skritih "leak-ov" v strategiji.
              </p>
            </div>

            {/* TIME FILTER */}
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1">
              <Filter className="w-3.5 h-3.5 text-zinc-500 ml-2 mr-1" />
              {filterButtons.map(b => (
                <button
                  key={b.key}
                  onClick={() => setTimeFilter(b.key)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    timeFilter === b.key
                      ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TILT WARNING */}
        {analytics.tiltDetected && (
          <div className="mb-8 p-5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-4 shadow-[0_0_30px_-10px_rgba(244,63,94,0.3)]">
            <div className="p-2.5 bg-rose-500/20 rounded-xl shrink-0">
              <Flame className="w-5 h-5 text-rose-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-black text-rose-300 text-sm uppercase tracking-widest">Tilt vzorec zaznan</h4>
                <span className="text-[9px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-md font-black uppercase tracking-widest">Pomembno</span>
              </div>
              <p className="text-sm text-rose-200/80 font-medium leading-relaxed">
                Po 3+ zaporednih izgubah povečaš povprečen vložek z <b>{eurDec(analytics.avgStakeNormal)}</b> na <b>{eurDec(analytics.avgStakeAfterLoss)}</b>{" "}
                ({((analytics.avgStakeAfterLoss / analytics.avgStakeNormal - 1) * 100).toFixed(0)}% več). To je klasičen tilt - ostani pri flat staking-u.
              </p>
            </div>
          </div>
        )}

        {/* ROW 0: STATISTIKA POVZETEK */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 md:p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">Total ROI</span>
            </div>
            <p className={`text-xl md:text-2xl font-mono font-black ${analytics.totalRoi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {analytics.totalRoi > 0 ? '+' : ''}{analytics.totalRoi.toFixed(2)}%
            </p>
            <p className="text-[10px] text-zinc-500 font-mono mt-1 truncate">{eur(analytics.totalProfit)}</p>
          </div>

          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 md:p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">Win Rate</span>
            </div>
            <p className="text-xl md:text-2xl font-mono font-black text-white">{analytics.winRate.toFixed(1)}%</p>
            <p className="text-[10px] text-zinc-500 font-mono mt-1">{analytics.settledCount} stav</p>
          </div>

          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 md:p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">Sharpe</span>
            </div>
            <p className="text-xl md:text-2xl font-mono font-black text-white">{analytics.sharpe.toFixed(2)}</p>
            <p className="text-[10px] text-zinc-500 font-mono mt-1">σ: {eurDec(analytics.sd)}</p>
          </div>

          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 md:p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">Max DD</span>
            </div>
            <p className="text-xl md:text-2xl font-mono font-black text-rose-400 truncate">{eur(analytics.maxDrawdown)}</p>
            <p className="text-[10px] text-zinc-500 font-mono mt-1">Avg odds: {analytics.avgOdds.toFixed(2)}</p>
          </div>
        </div>

        {/* ROW 1: 3 KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-amber-500/20 rounded-[2rem] p-6 md:p-8 relative overflow-hidden shadow-[0_0_30px_-10px_rgba(245,158,11,0.1)] hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-amber-500/10 rounded-xl"><ShieldAlert className="w-5 h-5 text-amber-500" /></div>
              <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-zinc-400">Trenutna Izpostavljenost</span>
            </div>
            <h4 className="text-3xl md:text-4xl font-mono font-black text-amber-400 mb-2 truncate">{eur(analytics.exposure)}</h4>
            <div className="flex flex-wrap justify-between gap-2 mt-4 pt-4 border-t border-white/5 text-xs text-zinc-500 font-medium">
              <span>Odprtih: <span className="text-white font-bold">{analytics.openCount}</span></span>
              <span>Pot.: <span className="text-emerald-400 font-bold">+{eur(analytics.potentialProfit)}</span></span>
            </div>
          </div>

          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-emerald-500/20 rounded-[2rem] p-6 md:p-8 relative overflow-hidden shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl"><Zap className="w-5 h-5 text-emerald-500" /></div>
              <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-zinc-400">Najdaljši Win Streak</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <h4 className="text-3xl md:text-4xl font-mono font-black text-emerald-400">{analytics.maxWin}</h4>
              <span className="text-sm font-bold text-zinc-500">zapored</span>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 text-xs text-zinc-500 font-medium">Tvoj psihološki "God mode".</div>
          </div>

          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-rose-500/20 rounded-[2rem] p-6 md:p-8 relative overflow-hidden shadow-[0_0_30px_-10px_rgba(244,63,94,0.1)] hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-rose-500/10 rounded-xl"><TrendingDown className="w-5 h-5 text-rose-500" /></div>
              <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-zinc-400">Max Drawdown Streak</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <h4 className="text-3xl md:text-4xl font-mono font-black text-rose-400">{analytics.maxLoss}</h4>
              <span className="text-sm font-bold text-zinc-500">izgub zapored</span>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 text-xs text-zinc-500 font-medium">Spomni se tega ob naslednjem padcu.</div>
          </div>
        </div>

        {/* CUMULATIVE PROFIT GRAF */}
        {analytics.cumulativeData.length > 1 && (
          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-2xl mb-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-violet-400" /> Kumulativni Profit
              </h3>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest">{analytics.cumulativeData.length} stav</span>
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.cumulativeData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="idx" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `€${v}`} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                  <Tooltip
                    contentStyle={{ background: '#121214', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    labelStyle={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase' }}
                    formatter={(value: any) => [eur(value), 'Profit']}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: '#8b5cf6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ROW 2: PREMATCH VS LIVE & STAKE BRACKETS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-2xl flex flex-col justify-between">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
              <Clock className="w-4 h-4 text-cyan-400" /> Prematch vs. Live Efektivnost
            </h3>
            <div className="grid grid-cols-2 gap-4 flex-1">
              <button
                onClick={() => openModal("Prematch stave", filteredRows.filter(r => r.cas_stave === "PREMATCH" && r.wl !== "OPEN" && r.wl !== "VOID"))}
                className="bg-white/[0.02] border border-white/[0.05] rounded-[1.5rem] p-5 flex flex-col justify-center items-center text-center hover:bg-white/[0.05] hover:border-white/10 transition-all"
              >
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Prematch ({analytics.prematch.count})</span>
                <span className={`text-2xl md:text-3xl font-mono font-black mb-1 ${analytics.prematch.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {analytics.prematch.roi > 0 ? '+' : ''}{analytics.prematch.roi.toFixed(1)}%
                </span>
                <span className="text-xs font-mono text-zinc-400">P: {eur(analytics.prematch.profit)}</span>
              </button>
              <button
                onClick={() => openModal("Live stave", filteredRows.filter(r => r.cas_stave === "LIVE" && r.wl !== "OPEN" && r.wl !== "VOID"))}
                className="bg-white/[0.02] border border-white/[0.05] rounded-[1.5rem] p-5 flex flex-col justify-center items-center text-center relative overflow-hidden hover:bg-white/[0.05] hover:border-white/10 transition-all"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 blur-[20px]" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 relative z-10">Live ({analytics.live.count})</span>
                <span className={`text-2xl md:text-3xl font-mono font-black mb-1 relative z-10 ${analytics.live.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {analytics.live.roi > 0 ? '+' : ''}{analytics.live.roi.toFixed(1)}%
                </span>
                <span className="text-xs font-mono text-zinc-400 relative z-10">P: {eur(analytics.live.profit)}</span>
              </button>
            </div>
          </div>

          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                <Coins className="w-4 h-4 text-amber-400" /> Stake Size Edge (Vložki)
              </h3>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest animate-pulse border border-white/10 px-2 py-1 rounded-md">Klikni stolpec</span>
            </div>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.stakeBrackets} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `€${v}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }} />
                  <Bar
                    dataKey="profit"
                    radius={[8, 8, 0, 0]}
                    cursor="pointer"
                    onClick={(data: any) => openModal(`Velikost vložka: ${data?.payload?.name || data?.name || ''}`, data?.payload?.bets || data?.bets || [])}
                  >
                    {analytics.stakeBrackets.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#f59e0b" : "#f43f5e"} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ROW 3: GOD-TIER VS TOXIC COMBOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-emerald-500/20 rounded-[2.5rem] p-6 md:p-8 shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)]">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
              <Trophy className="w-4 h-4 text-emerald-400" /> God-Tier Kombinacije
              <span className="text-[8px] text-zinc-600 normal-case tracking-normal">(min 5 stav)</span>
            </h3>
            <div className="flex flex-col gap-3">
              {analytics.topCombos.length > 0 ? analytics.topCombos.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-zinc-200 uppercase tracking-widest truncate">{c.name}</p>
                    <p className="text-[10px] text-zinc-500 font-medium">{c.count} stav · WR {c.count > 0 ? ((c.wins / c.count) * 100).toFixed(0) : 0}%</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-mono text-base font-black text-emerald-400">{eur(c.profit)}</p>
                    <p className="text-[10px] font-mono text-emerald-500/70">ROI: {c.roi.toFixed(1)}%</p>
                  </div>
                </div>
              )) : <p className="text-xs text-zinc-500">Premalo podatkov (min 5 stav).</p>}
            </div>
          </div>

          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-rose-500/20 rounded-[2.5rem] p-6 md:p-8 shadow-[0_0_30px_-10px_rgba(244,63,94,0.1)]">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
              <Skull className="w-4 h-4 text-rose-400" /> Toksične Kombinacije
              <span className="text-[8px] text-zinc-600 normal-case tracking-normal">(min 5 stav)</span>
            </h3>
            <div className="flex flex-col gap-3">
              {analytics.toxicCombos.length > 0 ? analytics.toxicCombos.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-zinc-200 uppercase tracking-widest truncate">{c.name}</p>
                    <p className="text-[10px] text-zinc-500 font-medium">{c.count} stav · WR {c.count > 0 ? ((c.wins / c.count) * 100).toFixed(0) : 0}%</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-mono text-base font-black text-rose-400">{eur(c.profit)}</p>
                    <p className="text-[10px] font-mono text-rose-500/70">ROI: {c.roi.toFixed(1)}%</p>
                  </div>
                </div>
              )) : <p className="text-xs text-zinc-500">Premalo podatkov (min 5 stav).</p>}
            </div>
          </div>
        </div>

        {/* ROW 4: ROI TABLES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <RoiTable title="Učinkovitost Tipsterjev" data={analytics.tipstersList} icon={Target} onRowClick={openModal} prefix="Tipster" />
          <RoiTable title="Učinkovitost Športov" data={analytics.sportsList} icon={Layers} onRowClick={openModal} prefix="Šport" />
        </div>

        {/* ROW 5: CHARTS (ODDS & DAYS) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                <Crosshair className="w-4 h-4 text-violet-400" /> Odds Sweet Spot
              </h3>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest animate-pulse border border-white/10 px-2 py-1 rounded-md">Klikni stolpec</span>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.oddsBrackets} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `€${v}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }} />
                  <Bar
                    dataKey="profit"
                    radius={[8, 8, 0, 0]}
                    cursor="pointer"
                    onClick={(data: any) => openModal(`Kvote: ${data?.payload?.name || data?.name || ''}`, data?.payload?.bets || data?.bets || [])}
                  >
                    {analytics.oddsBrackets.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#8b5cf6" : "#f43f5e"} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                <CalendarDays className="w-4 h-4 text-cyan-400" /> Donosnost po dnevih
              </h3>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest animate-pulse border border-white/10 px-2 py-1 rounded-md">Klikni stolpec</span>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.daysData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `€${v}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }} />
                  <Bar
                    dataKey="profit"
                    radius={[8, 8, 0, 0]}
                    cursor="pointer"
                    onClick={(data: any) => openModal(`Dan: ${data?.payload?.name || data?.name || ''}`, data?.payload?.bets || data?.bets || [])}
                  >
                    {analytics.daysData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#06b6d4" : "#f43f5e"} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* INSIGHTS BOX */}
        <div className="p-6 md:p-8 bg-violet-900/10 border border-violet-500/20 rounded-3xl flex items-start gap-5 shadow-xl">
          <div className="p-3 bg-violet-500/20 rounded-xl shrink-0">
            <Brain className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h4 className="font-bold text-violet-300 text-sm mb-2 uppercase tracking-wide">Kako uporabiti te podatke?</h4>
            <p className="text-sm text-violet-200/70 font-medium leading-relaxed max-w-4xl">
              Strogo obreži svoje izgube! Če tabela <b>Toksičnih Kombinacij</b> kaže, da na določenem športu redno izgubljaš, prenehaj s stavami na ta šport (ali tega tipsterja).
              Preveri tudi <b>Stake Size Edge</b> – če imaš pri visokih vložkih negativen ROI, to pomeni, da ti čustva zameglijo objektivno presojo. Zadrži se in igraj ravno (flat staking).
              <br /><br />
              <b>Sharpe Ratio</b> nad 0.5 pomeni stabilno strategijo. Pod 0 pomeni, da si pogosto v izgubi. <b>Max Drawdown</b> ti pove, koliko denarja moraš imeti v bankrolu, da preživiš najslabši scenarij.
            </p>
          </div>
        </div>

      </div>

      {/* MODAL */}
      {modalData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setModalData(null)}
        >
          <div
            className="bg-[#18181b] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 text-violet-400" />
                </div>
                <h3 id="modal-title" className="font-black text-white uppercase tracking-widest text-sm md:text-base truncate">{modalData.title}</h3>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest shrink-0 hidden sm:inline">
                  ({modalData.bets.length})
                </span>
              </div>
              <button
                onClick={() => setModalData(null)}
                aria-label="Zapri"
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2 overflow-y-auto flex-1 bg-black/20" style={{ scrollbarWidth: 'thin' }}>
              {modalData.bets.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 uppercase tracking-widest text-xs font-bold">
                  Ni zadetkov v tej kategoriji.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 p-2">
                  {[...modalData.bets]
                    .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())
                    .map(bet => {
                      const p = calcProfit(bet);
                      const isWin = ["WIN", "BACK WIN", "LAY WIN"].includes(bet.wl);
                      const isLoss = bet.wl === "LOSS";
                      const odds = getEffectiveOdds(bet);

                      return (
                        <div key={bet.id} className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl bg-[#18181b] border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                                isWin ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : isLoss ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                              }`}>
                                {bet.wl}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-bold uppercase">{bet.sport}</span>
                            </div>
                            <p className="text-sm font-bold text-white truncate">{bet.dogodek || bet.sport}</p>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">{bet.tip || "-"}</p>
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500 font-medium flex-wrap">
                              <span>{new Date(bet.datum).toLocaleDateString('sl-SI')}</span>
                              <span>•</span>
                              <span className="text-violet-400 font-bold">{bet.tipster}</span>
                              {bet.stavnica && (<><span>•</span><span>{bet.stavnica}</span></>)}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className={`font-mono text-base md:text-lg font-black ${p >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {p > 0 ? '+' : ''}{eurDec(p)}
                            </p>
                            <div className="flex flex-col items-end mt-1 gap-0.5">
                              <span className="text-[10px] text-zinc-400 font-mono">Kvota: <span className="text-white font-bold">{odds > 0 ? odds.toFixed(2) : '-'}</span></span>
                              <span className="text-[10px] text-zinc-400 font-mono">Vložek: <span className="text-white font-bold">€{calcRisk(bet).toFixed(2)}</span></span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// --- KOMPONENTA TABELE Z ROI (kliki + win rate) ---
function RoiTable({ title, data, icon: Icon, onRowClick, prefix }: {
  title: string;
  data: any[];
  icon: any;
  onRowClick: (title: string, bets: Bet[]) => void;
  prefix: string;
}) {
  return (
    <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-2xl flex flex-col">
      <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
        <Icon className="w-4 h-4 text-violet-400" /> {title}
        <span className="text-[8px] text-zinc-600 normal-case tracking-normal">(ROI po tveganju)</span>
      </h3>
      <div className="flex flex-col gap-2 flex-1">
        {data.length === 0 ? (
          <p className="text-xs text-zinc-500">Ni podatkov.</p>
        ) : data.map((item: any, idx: number) => (
          <button
            key={idx}
            onClick={() => onRowClick(`${prefix}: ${item.name}`, item.bets || [])}
            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest truncate">{item.name}</p>
              <p className="text-[10px] text-zinc-500 font-medium">
                {item.count} stav · WR {item.winRate?.toFixed(0) || 0}%
              </p>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className={`font-mono text-sm font-black ${item.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {item.roi > 0 ? '+' : ''}{item.roi.toFixed(1)}%
              </p>
              <p className="text-[10px] font-mono text-zinc-500">P: {eur(item.profit)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}