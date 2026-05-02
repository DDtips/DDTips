"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import {
  Crosshair, AlertTriangle, TrendingDown, TrendingUp, Zap, CalendarDays, 
  Loader2, Radar, ShieldAlert, Skull, Trophy, Layers, Target, Clock, Coins, X
} from "lucide-react";

// --- TIPOVI ---
type WL = "OPEN" | "WIN" | "LOSS" | "VOID" | "BACK WIN" | "LAY WIN";
type Bet = {
  id: string; datum: string; wl: WL; kvota1: number; vplacilo1: number;
  lay_kvota: number; vplacilo2: number; komisija: number; sport: string;
  tipster: string; cas_stave: string; dogodek?: string; tip?: string; stavnica?: string;
};

// --- POMOŽNE FUNKCIJE ---
function eur(n: number) { return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function eurDec(n: number) { return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function hasLay(b: Bet) { return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0; }
function hasBack(b: Bet) { return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0; }

function calcProfit(b: Bet): number {
  if (!b || b.wl === "OPEN" || b.wl === "VOID" || !b.wl) return 0;
  const komZnesek = Number(b.komisija ?? 0);
  const backStake = Number(b.vplacilo1 ?? 0); const backOdds = Number(b.kvota1 ?? 0);
  const layLiability = Number(b.vplacilo2 ?? 0); const layOdds = Number(b.lay_kvota ?? 0);
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;

  let brutoProfit = 0;
  if (hasBack(b) && hasLay(b)) {
    const pBW = (backStake * (backOdds - 1)) - layLiability; const pLW = layStake - backStake;
    if (b.wl === "BACK WIN") brutoProfit = pBW; else if (b.wl === "LAY WIN") brutoProfit = pLW;
    else if (b.wl === "WIN") brutoProfit = Math.max(pBW, pLW); else if (b.wl === "LOSS") brutoProfit = Math.min(pBW, pLW);
  } else if (!hasBack(b) && hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") brutoProfit = layStake; else if (b.wl === "LOSS" || b.wl === "BACK WIN") brutoProfit = -layLiability;
  } else if (hasBack(b) && !hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") brutoProfit = backStake * (backOdds - 1); else if (b.wl === "LOSS" || b.wl === "LAY WIN") brutoProfit = -backStake;
  }
  return brutoProfit > 0 ? brutoProfit - komZnesek : brutoProfit;
}

function calcRisk(b: Bet): number {
  const backStake = Number(b.vplacilo1 ?? 0); const layLiability = Number(b.vplacilo2 ?? 0);
  if (hasBack(b) && !hasLay(b)) return backStake;
  if (!hasBack(b) && hasLay(b)) return layLiability;
  if (hasBack(b) && hasLay(b)) return Math.max(backStake, layLiability);
  return 0;
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
  
  // State za modal, ki prikaže stave ob kliku na graf
  const [modalData, setModalData] = useState<{title: string, bets: Bet[]} | null>(null);

  useEffect(() => {
    const fetchBets = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data } = await supabase.from("bets").select("*").order("datum", { ascending: true });
      if (data) setRows(data as Bet[]);
      setLoading(false);
    };
    fetchBets();
  }, [router]);

  const analytics = useMemo(() => {
    const validRows = rows.filter(r => r && r.wl);
    const settled = validRows.filter(r => r.wl !== "OPEN" && r.wl !== "VOID");
    const openBets = validRows.filter(r => r.wl === "OPEN");
    
    // 1. Trenutna izpostavljenost
    const exposure = openBets.reduce((acc, r) => acc + calcRisk(r), 0);
    const potentialProfit = openBets.reduce((acc, r) => {
        const risk = calcRisk(r);
        const odds = Number(r.kvota1) > 0 ? Number(r.kvota1) : (Number(r.lay_kvota) > 0 ? Number(r.lay_kvota) : 1);
        return acc + (risk * (odds - 1));
    }, 0);

    // 2. Streaks
    let currentWin = 0, maxWin = 0, currentLoss = 0, maxLoss = 0;
    settled.forEach(b => {
      const isWin = ["WIN", "BACK WIN", "LAY WIN"].includes(b.wl);
      const isLoss = b.wl === "LOSS";
      if (isWin) { currentWin++; currentLoss = 0; maxWin = Math.max(maxWin, currentWin); }
      else if (isLoss) { currentLoss++; currentWin = 0; maxLoss = Math.max(maxLoss, currentLoss); }
      else { currentWin = 0; currentLoss = 0; }
    });

    // 3. Brackets in tabele, s praznimi nizi za shranjevanje stav
    const oddsBrackets = [
      { name: '< 1.50', min: 0, max: 1.499, profit: 0, count: 0, bets: [] as Bet[] },
      { name: '1.50-1.99', min: 1.50, max: 1.999, profit: 0, count: 0, bets: [] as Bet[] },
      { name: '2.00-2.99', min: 2.00, max: 2.999, profit: 0, count: 0, bets: [] as Bet[] },
      { name: '3.00+', min: 3.00, max: 9999, profit: 0, count: 0, bets: [] as Bet[] }
    ];

    const stakeBrackets = [
        { name: '< 30€', min: 0, max: 29.99, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] },
        { name: '30-60€', min: 30, max: 59.99, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] },
        { name: '60-100€', min: 60, max: 99.99, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] },
        { name: '100€+', min: 100, max: 99999, profit: 0, risk: 0, count: 0, roi: 0, bets: [] as Bet[] }
    ];

    const dayNames = ["Nedelja", "Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota"];
    const daysData = dayNames.map(day => ({ name: day, profit: 0, count: 0, bets: [] as Bet[] }));

    let prematch = { profit: 0, risk: 0, count: 0, roi: 0 };
    let live = { profit: 0, risk: 0, count: 0, roi: 0 };

    const comboMap = new Map();
    const sportMap = new Map();
    const tipsterMap = new Map();

    settled.forEach(b => {
      const p = calcProfit(b);
      const r = calcRisk(b);
      const odds = Number(b.kvota1) > 0 ? Number(b.kvota1) : Number(b.lay_kvota);

      // Prematch vs Live
      if (b.cas_stave === "PREMATCH") { prematch.profit += p; prematch.risk += r; prematch.count++; }
      else if (b.cas_stave === "LIVE") { live.profit += p; live.risk += r; live.count++; }

      // Odds Sweet spot
      if (odds > 0) {
        const br = oddsBrackets.find(br => odds >= br.min && odds <= br.max);
        if (br) { br.profit += p; br.count++; br.bets.push(b); }
      }

      // Stake Brackets
      const stBr = stakeBrackets.find(br => r >= br.min && r <= br.max);
      if (stBr) { stBr.profit += p; stBr.risk += r; stBr.count++; stBr.bets.push(b); }

      // Days
      if (b.datum) {
        const dateObj = new Date(b.datum);
        if (!isNaN(dateObj.getTime())) {
          const d = dateObj.getDay();
          if (daysData[d]) { daysData[d].profit += p; daysData[d].count++; daysData[d].bets.push(b); }
        }
      }

      // Combos, Sports, Tipsters
      const sKey = b.sport || "OSTALO";
      const tKey = b.tipster || "NEZNANO";
      const cKey = `${tKey} • ${sKey}`;

      if (!sportMap.has(sKey)) sportMap.set(sKey, { name: sKey, profit: 0, risk: 0, count: 0 });
      if (!tipsterMap.has(tKey)) tipsterMap.set(tKey, { name: tKey, profit: 0, risk: 0, count: 0 });
      if (!comboMap.has(cKey)) comboMap.set(cKey, { name: cKey, profit: 0, risk: 0, count: 0 });

      sportMap.get(sKey).profit += p; sportMap.get(sKey).risk += r; sportMap.get(sKey).count++;
      tipsterMap.get(tKey).profit += p; tipsterMap.get(tKey).risk += r; tipsterMap.get(tKey).count++;
      comboMap.get(cKey).profit += p; comboMap.get(cKey).risk += r; comboMap.get(cKey).count++;
    });
    
    // Shift sunday
    const sunday = daysData.shift();
    if(sunday) daysData.push(sunday);

    // Calculate ROIs
    const calcRoi = (profit: number, risk: number) => risk > 0 ? (profit / risk) * 100 : 0;
    
    prematch.roi = calcRoi(prematch.profit, prematch.risk);
    live.roi = calcRoi(live.profit, live.risk);
    stakeBrackets.forEach(b => b.roi = calcRoi(b.profit, b.risk));

    const combos = Array.from(comboMap.values()).map(c => ({...c, roi: calcRoi(c.profit, c.risk)}));
    combos.sort((a, b) => b.profit - a.profit); 
    
    // Valid combos
    const validCombos = combos.filter(c => c.count >= 3);
    const topCombos = validCombos.slice(0, 4);
    const toxicCombos = validCombos.slice(-4).reverse();

    const sportsList = Array.from(sportMap.values()).map(s => ({...s, roi: calcRoi(s.profit, s.risk)})).filter(s => s.count > 0).sort((a,b) => b.roi - a.roi);
    const tipstersList = Array.from(tipsterMap.values()).map(t => ({...t, roi: calcRoi(t.profit, t.risk)})).filter(t => t.count > 0).sort((a,b) => b.roi - a.roi);

    return { 
        exposure, openCount: openBets.length, potentialProfit, maxWin, maxLoss, 
        oddsBrackets, daysData, stakeBrackets, prematch, live, 
        topCombos, toxicCombos, sportsList, tipstersList 
    };
  }, [rows]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#050508]"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>;

  // Reusable Table Component for True ROI
  const TrueRoiTable = ({ title, data, icon: Icon }: any) => (
      <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 shadow-2xl flex flex-col">
          <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
              <Icon className="w-4 h-4 text-violet-400" /> {title} (True ROI)
          </h3>
          <div className="flex flex-col gap-2 flex-1">
              {data.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.02] group hover:bg-white/[0.05] transition-colors">
                      <div>
                          <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">{item.name}</p>
                          <p className="text-[10px] text-zinc-500 font-medium">{item.count} stav</p>
                      </div>
                      <div className="text-right">
                          <p className={`font-mono text-sm font-black ${item.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {item.roi > 0 ? '+' : ''}{item.roi.toFixed(1)}%
                          </p>
                          <p className="text-[10px] font-mono text-zinc-500">P: {eur(item.profit)}</p>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  return (
    <main className="min-h-screen bg-[#050508] text-white antialiased selection:bg-violet-500/30 pb-24">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-950/20 via-transparent to-transparent" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-8 pt-44 pb-12 z-10">
        
        {/* HEADER */}
        <div className="mb-10 border-b border-white/5 pb-8">
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <Radar className="w-5 h-5 text-violet-400" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Deep Analytics</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white">Finding the <span className="text-violet-500">Edge</span></h2>
            <p className="text-zinc-500 text-sm mt-3 font-medium">Analiza matematičnih vzorcev, tveganja in skritih "leak-ov" v strategiji.</p>
        </div>

        {/* ROW 1: 3 KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-[#18181b]/50 backdrop-blur-xl border border-amber-500/20 rounded-[2rem] p-8 relative overflow-hidden shadow-[0_0_30px_-10px_rgba(245,158,11,0.1)] hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-amber-500/10 rounded-xl"><ShieldAlert className="w-5 h-5 text-amber-500" /></div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Trenutna Izpostavljenost</span>
                </div>
                <h4 className="text-4xl font-mono font-black text-amber-400 mb-2">{eur(analytics.exposure)}</h4>
                <div className="flex justify-between mt-4 pt-4 border-t border-white/5 text-xs text-zinc-500 font-medium">
                    <span>Odprtih stav: <span className="text-white font-bold">{analytics.openCount}</span></span>
                    <span>Potencial: <span className="text-emerald-400 font-bold">+{eur(analytics.potentialProfit)}</span></span>
                </div>
            </div>

            <div className="bg-[#18181b]/50 backdrop-blur-xl border border-emerald-500/20 rounded-[2rem] p-8 relative overflow-hidden shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl"><Zap className="w-5 h-5 text-emerald-500" /></div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Najdaljši Win Streak</span>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                    <h4 className="text-4xl font-mono font-black text-emerald-400">{analytics.maxWin}</h4>
                    <span className="text-sm font-bold text-zinc-500">stav zapored</span>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 text-xs text-zinc-500 font-medium">Tvoj psihološki "God mode".</div>
            </div>

            <div className="bg-[#18181b]/50 backdrop-blur-xl border border-rose-500/20 rounded-[2rem] p-8 relative overflow-hidden shadow-[0_0_30px_-10px_rgba(244,63,94,0.1)] hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-rose-500/10 rounded-xl"><TrendingDown className="w-5 h-5 text-rose-500" /></div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Max Drawdown Streak</span>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                    <h4 className="text-4xl font-mono font-black text-rose-400">{analytics.maxLoss}</h4>
                    <span className="text-sm font-bold text-zinc-500">izgub zapored</span>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 text-xs text-zinc-500 font-medium">Spomni se tega ob naslednjem padcu.</div>
            </div>
        </div>

        {/* ROW 2: PREMATCH VS LIVE & STAKE BRACKETS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Prematch vs Live Efektivnost */}
            <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl flex flex-col justify-between">
                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-cyan-400" /> Prematch vs. Live Efektivnost
                </h3>
                <div className="grid grid-cols-2 gap-4 flex-1">
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-[1.5rem] p-5 flex flex-col justify-center items-center text-center">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Prematch ({analytics.prematch.count})</span>
                        <span className={`text-3xl font-mono font-black mb-1 ${analytics.prematch.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {analytics.prematch.roi > 0 ? '+' : ''}{analytics.prematch.roi.toFixed(1)}%
                        </span>
                        <span className="text-xs font-mono text-zinc-400">P: {eur(analytics.prematch.profit)}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-[1.5rem] p-5 flex flex-col justify-center items-center text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 blur-[20px]" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 relative z-10">Live ({analytics.live.count})</span>
                        <span className={`text-3xl font-mono font-black mb-1 relative z-10 ${analytics.live.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {analytics.live.roi > 0 ? '+' : ''}{analytics.live.roi.toFixed(1)}%
                        </span>
                        <span className="text-xs font-mono text-zinc-400 relative z-10">P: {eur(analytics.live.profit)}</span>
                    </div>
                </div>
            </div>

            {/* Stake Size Edge */}
            <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
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
                                onClick={(data) => setModalData({ title: `Velikost vložka: ${data.name}`, bets: data.bets })}
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
            <div className="bg-[#18181b]/50 backdrop-blur-xl border border-emerald-500/20 rounded-[2.5rem] p-8 shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)]">
                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                    <Trophy className="w-4 h-4 text-emerald-400" /> God-Tier Kombinacije
                </h3>
                <div className="flex flex-col gap-3">
                    {analytics.topCombos.length > 0 ? analytics.topCombos.map((c: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                            <div>
                                <p className="text-xs font-bold text-zinc-200 uppercase tracking-widest">{c.name}</p>
                                <p className="text-[10px] text-zinc-500 font-medium">{c.count} stav</p>
                            </div>
                            <div className="text-right">
                                <p className="font-mono text-base font-black text-emerald-400">{eur(c.profit)}</p>
                                <p className="text-[10px] font-mono text-emerald-500/70">ROI: {c.roi.toFixed(1)}%</p>
                            </div>
                        </div>
                    )) : <p className="text-xs text-zinc-500">Premalo podatkov (min 3 stave).</p>}
                </div>
            </div>

            <div className="bg-[#18181b]/50 backdrop-blur-xl border border-rose-500/20 rounded-[2.5rem] p-8 shadow-[0_0_30px_-10px_rgba(244,63,94,0.1)]">
                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                    <Skull className="w-4 h-4 text-rose-400" /> Toksične Kombinacije
                </h3>
                <div className="flex flex-col gap-3">
                    {analytics.toxicCombos.length > 0 ? analytics.toxicCombos.map((c: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
                            <div>
                                <p className="text-xs font-bold text-zinc-200 uppercase tracking-widest">{c.name}</p>
                                <p className="text-[10px] text-zinc-500 font-medium">{c.count} stav</p>
                            </div>
                            <div className="text-right">
                                <p className="font-mono text-base font-black text-rose-400">{eur(c.profit)}</p>
                                <p className="text-[10px] font-mono text-rose-500/70">ROI: {c.roi.toFixed(1)}%</p>
                            </div>
                        </div>
                    )) : <p className="text-xs text-zinc-500">Premalo podatkov (min 3 stave).</p>}
                </div>
            </div>
        </div>

        {/* ROW 4: TRUE ROI TABLES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <TrueRoiTable title="Učinkovitost Tipsterjev" data={analytics.tipstersList} icon={Target} />
            <TrueRoiTable title="Učinkovitost Športov" data={analytics.sportsList} icon={Layers} />
        </div>

        {/* ROW 5: CHARTS (ODDS & DAYS) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
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
                                onClick={(data) => setModalData({ title: `Kvote: ${data.name}`, bets: data.bets })}
                            >
                                {analytics.oddsBrackets.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#8b5cf6" : "#f43f5e"} className="hover:opacity-80 transition-opacity" />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
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
                                onClick={(data) => setModalData({ title: `Dan: ${data.name}`, bets: data.bets })}
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

        {/* INFO FOOTER */}
        <div className="p-6 md:p-8 bg-violet-900/10 border border-violet-500/20 rounded-3xl flex items-start gap-5 shadow-xl">
            <div className="p-3 bg-violet-500/20 rounded-xl shrink-0">
               <AlertTriangle className="w-6 h-6 text-violet-400" />
            </div>
            <div>
                <h4 className="font-bold text-violet-300 text-sm mb-2 uppercase tracking-wide">Kako uporabiti te podatke?</h4>
                <p className="text-sm text-violet-200/70 font-medium leading-relaxed max-w-4xl">
                    Strogo obreži svoje izgube! Če tabela <b>Toksičnih Kombinacij</b> kaže, da na določenem športu redno izgubljaš, prenehaj s stavami na ta šport (ali tega tipsterja). Preveri tudi <b>Stake Size Edge</b> – če imaš pri visokih vložkih negativen ROI, to pomeni, da ti čustva zameglijo objektivno presojo. Zadrži se in igraj ravno (flat staking).
                </p>
            </div>
        </div>

      </div>

      {/* MODAL ZA PRIKAZ STAV */}
      {modalData && (
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" 
            onClick={() => setModalData(null)}
        >
            <div 
                className="bg-[#18181b] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" 
                onClick={e => e.stopPropagation()} // Prepreči zapiranje ob kliku na vsebino
            >
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-violet-400" />
                        </div>
                        <h3 className="font-black text-white uppercase tracking-widest">{modalData.title}</h3>
                    </div>
                    <button 
                        onClick={() => setModalData(null)} 
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* List of Bets */}
                <div className="p-2 overflow-y-auto custom-scrollbar flex-1 bg-black/20">
                    {modalData.bets.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 uppercase tracking-widest text-xs font-bold">
                            Ni zadetkov v tej kategoriji.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5 p-2">
                            {modalData.bets.sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime()).map(bet => {
                                const p = calcProfit(bet);
                                const isWin = ["WIN", "BACK WIN", "LAY WIN"].includes(bet.wl);
                                const isLoss = bet.wl === "LOSS";
                                
                                return (
                                    <div key={bet.id} className="flex items-center gap-4 p-4 rounded-xl bg-[#18181b] border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${isWin ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : isLoss ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                                                    {bet.wl}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 font-bold uppercase">{bet.sport}</span>
                                            </div>
                                            <p className="text-sm font-bold text-white truncate">{bet.dogodek || bet.sport}</p>
                                            <p className="text-xs text-zinc-400 truncate mt-0.5">{bet.tip || "-"}</p>
                                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500 font-medium">
                                                <span>{new Date(bet.datum).toLocaleDateString('sl-SI')}</span>
                                                <span>•</span>
                                                <span className="text-violet-400 font-bold">{bet.tipster}</span>
                                                {bet.stavnica && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{bet.stavnica}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="text-right shrink-0">
                                            <p className={`font-mono text-lg font-black ${p >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {p > 0 ? '+' : ''}{eurDec(p)}
                                            </p>
                                            <div className="flex flex-col items-end mt-1 gap-0.5">
                                                <span className="text-[10px] text-zinc-400 font-mono">Kvota: <span className="text-white font-bold">{bet.kvota1 > 0 ? bet.kvota1.toFixed(2) : bet.lay_kvota?.toFixed(2)}</span></span>
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