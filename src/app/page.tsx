"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie,
  XAxis, YAxis, Tooltip, CartesianGrid, LabelList, Legend, ReferenceLine
} from "recharts";
import {
  TrendingUp, Activity, Clock, ArrowUpRight, ArrowDownRight,
  Wallet, PieChart as PieIcon, CalendarDays, Users, Sparkles, Target, Landmark
} from "lucide-react";

// --- TIPOVI IN KONSTANTE ---
type WL = "OPEN" | "WIN" | "LOSS" | "VOID" | "BACK WIN" | "LAY WIN";

type Bet = {
  id: string; datum: string; wl: WL; kvota1: number; vplacilo1: number; lay_kvota: number;
  vplacilo2: number; komisija: number; sport: string; cas_stave: string;
  tipster: string; stavnica: string; mode?: "BET" | "TRADING" | null;
};

const CAPITAL_TOTAL = 8500;
const BOOK_START: Record<string, number> = {
  SHARP: 1500, PINNACLE: 2000, BET365: 2000, WINAMAX: 1000, WWIN: 500, "E-STAVE": 500, "BET AT HOME": 1000,
};

const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"];
const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"];
const PIE_COLORS = ["#10b981", "#8b5cf6", "#f59e0b", "#3b82f6", "#ec4899", "#06b6d4", "#64748b"];

// --- POMOŽNE FUNKCIJE ---
function normBook(x: string) { return (x || "").toUpperCase().replace(/\s+/g, "").replace(/-/g, ""); }
function eur(n: number | undefined | null) { return (n ?? 0).toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function eurDec(n: number | undefined | null) { return (n ?? 0).toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function hasLay(b: Bet) { return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0; }
function hasBack(b: Bet) { return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0; }

function calcProfit(b: Bet): number {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;
  const komZnesek = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0; const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0; const layOdds = b.lay_kvota || 0;
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;
  let brutoProfit = 0;
  
  if (hasBack(b) && hasLay(b)) {
    const profitIfBackWins = (backStake * (backOdds - 1)) - layLiability;
    const profitIfLayWins = layStake - backStake;
    if (b.wl === "BACK WIN") brutoProfit = profitIfBackWins; else if (b.wl === "LAY WIN") brutoProfit = profitIfLayWins; else if (b.wl === "WIN") brutoProfit = Math.max(profitIfBackWins, profitIfLayWins); else if (b.wl === "LOSS") brutoProfit = Math.min(profitIfBackWins, profitIfLayWins);
  } else if (!hasBack(b) && hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") brutoProfit = layStake; else if (b.wl === "LOSS" || b.wl === "BACK WIN") brutoProfit = -layLiability;
  } else if (hasBack(b) && !hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") brutoProfit = backStake * (backOdds - 1); else if (b.wl === "LOSS" || b.wl === "LAY WIN") brutoProfit = -backStake;
  }
  return brutoProfit > 0 ? brutoProfit - komZnesek : brutoProfit;
}

function calcRisk(b: Bet): number {
    const hasBackBet = hasBack(b); const hasLayBet = hasLay(b);
    const backStake = b.vplacilo1 || 0; const layLiability = b.vplacilo2 || 0;
    if (hasBackBet && !hasLayBet) return backStake;
    if (!hasBackBet && hasLayBet) return layLiability;
    if (hasBackBet && hasLayBet) return Math.max(backStake, layLiability);
    return 0;
}

function buildStats(rows: Bet[]) {
  const settled = rows.filter((r) => r.wl !== "OPEN" && r.wl !== "VOID");
  const n = settled.length;
  const wins = settled.filter((r) => ["WIN", "BACK WIN", "LAY WIN"].includes(r.wl)).length;
  const losses = settled.filter((r) => r.wl === "LOSS").length;
  
  let totalVolume = 0;
  let profit = 0;

  settled.forEach((r) => {
    profit += calcProfit(r);
    totalVolume += calcRisk(r);
  });

  const bankroll = CAPITAL_TOTAL + profit;
  const donosNaKapital = ((bankroll - CAPITAL_TOTAL) / CAPITAL_TOTAL) * 100;
  const winRate = n > 0 ? (wins / n) * 100 : 0;
  const yieldPercent = totalVolume > 0 ? (profit / totalVolume) * 100 : 0;

  const recentForm = [...settled]
    .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())
    .slice(0, 5)
    .map(r => r.wl.includes("WIN") ? "W" : "L")
    .reverse();

  const profitByBook = new Map<string, number>();
  settled.forEach((r) => { const key = normBook(r.stavnica || "NEZNANO"); profitByBook.set(key, (profitByBook.get(key) ?? 0) + calcProfit(r)); });
  const balanceByBook: { name: string; start: number; profit: number; balance: number }[] = [];
  Object.entries(BOOK_START).forEach(([name, start]) => { 
      const p = profitByBook.get(normBook(name)) ?? 0; 
      balanceByBook.push({ name, start, profit: p, balance: start + p }); 
  });
  balanceByBook.sort((a, b) => b.balance - a.balance);

  const profitBySport = new Map<string, number>(); SPORTI.forEach(s => profitBySport.set(s, 0));
  const profitByTipster = new Map<string, number>(); TIPSTERJI.forEach(t => profitByTipster.set(t, 0));
  settled.forEach((r) => { 
      profitBySport.set(r.sport || "OSTALO", (profitBySport.get(r.sport || "OSTALO") ?? 0) + calcProfit(r)); 
      profitByTipster.set(r.tipster || "NEZNANO", (profitByTipster.get(r.tipster || "NEZNANO") ?? 0) + calcProfit(r)); 
  });
  
  const prematch = settled.filter((r) => r.cas_stave === "PREMATCH");
  const live = settled.filter((r) => r.cas_stave === "LIVE");

  return { 
      profit, bankroll, donosNaKapital, n, wins, losses, winRate, yieldPercent, 
      recentForm, balanceByBook, profitBySport, profitByTipster, 
      prematchCount: prematch.length, liveCount: live.length, 
      profitPrematch: prematch.reduce((acc, r) => acc + calcProfit(r), 0), 
      profitLive: live.reduce((acc, r) => acc + calcProfit(r), 0) 
  };
}

// --- KOMPONENTE UI ---

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0];
    return (
      <div className="bg-black/90 border border-white/10 rounded-lg p-3 shadow-2xl backdrop-blur-md">
        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1 tracking-wider">{label}</p>
        <div className="flex gap-2 items-center">
          <span className="text-[11px] text-zinc-500">Znesek:</span>
          <span className={`font-mono font-black text-sm ${dataPoint.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {dataPoint.value > 0 ? "+" : ""}{eurDec(dataPoint.value)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

function MetricCard({ title, value, subtitle, trend, icon, isPositive }: any) {
  const colorClass = isPositive === undefined ? "text-zinc-100" : (isPositive ? "text-emerald-400" : "text-rose-400");
  const glowClass = isPositive === undefined ? "border-white/10" : (isPositive ? "border-emerald-500/20" : "border-rose-500/20");
  const bgClass = isPositive === undefined ? "bg-zinc-900/40" : (isPositive ? "bg-emerald-950/20" : "bg-rose-950/20");
  const shadowClass = isPositive === undefined ? "" : (isPositive ? "shadow-[0_0_30px_-10px_rgba(16,185,129,0.15)]" : "shadow-[0_0_30px_-10px_rgba(244,63,94,0.15)]");

  return (
    <div className={`relative flex flex-col items-center justify-center text-center ${bgClass} backdrop-blur-md border ${glowClass} ${shadowClass} rounded-[2rem] p-6 overflow-hidden transition-all duration-300 hover:scale-[1.02] group`}>
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/2 blur-2xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-30 ${isPositive === undefined ? 'bg-white' : (isPositive ? 'bg-emerald-500' : 'bg-rose-500')}`} />
      <div className={`p-2.5 rounded-2xl mb-3 transition-transform duration-300 group-hover:-translate-y-1 relative z-10 ${isPositive === undefined ? 'bg-white/5 text-zinc-400' : (isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1 z-10">{title}</span>
      <span className={`font-mono text-3xl md:text-4xl font-black tracking-tighter drop-shadow-md z-10 ${colorClass}`}>
        {value}
      </span>
      {subtitle && (
        <div className="flex items-center gap-1.5 mt-2 z-10">
          {trend && (
            <div className={`flex items-center justify-center w-4 h-4 rounded-full ${trend === "up" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
              {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            </div>
          )}
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{subtitle}</p>
        </div>
      )}
    </div>
  );
}

function DataTable({ title, data, icon }: any) {
  const maxProfit = Math.max(...(data || []).map((d:any) => Math.abs(d.profit)));
  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm">
      <div className="p-4 border-b border-white/5 flex items-center gap-2 bg-black/20">
        <div className="opacity-80">{icon}</div>
        <h3 className="text-[11px] font-black uppercase tracking-wider text-zinc-400">{title}</h3>
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        {data.map((item:any, idx:number) => {
          const barWidth = maxProfit > 0 ? (Math.abs(item.profit) / maxProfit) * 100 : 0;
          const isPos = item.profit >= 0;
          return (
            <div key={idx} className="relative flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 opacity-15 ${isPos ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${barWidth}%` }} />
              <span className="relative z-10 text-[11px] font-bold text-zinc-300 uppercase tracking-wide">{item.label}</span>
              <span className={`relative z-10 font-mono text-[13px] font-black ${isPos ? "text-emerald-400" : "text-rose-400"}`}>{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState({ text: "Disciplina je most med cilji in dosežki.", author: "Jim Rohn" });

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await fetch('/api/quote', { cache: 'no-store' });
        if (!res.ok) throw new Error('Napaka API-ja');
        const data = await res.json();
        if (data && data.q) setQuote({ text: data.q, author: data.a });
      } catch (err) { /* silent */ }
    };

    const checkUserAndLoad = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from('profiles').select('is_approved').eq('id', user.id).single();
      if (!profile || !profile.is_approved) { router.replace("/pending"); return; }
      const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: true });
      if (!error) setRows((data ?? []) as Bet[]);
      setLoading(false);
    };

    fetchQuote(); checkUserAndLoad();
  }, [router]);

  const stats = useMemo(() => buildStats(rows), [rows]);

  const chartDaily = useMemo(() => {
    const now = new Date(); const currentYear = now.getFullYear(); const currentMonth = now.getMonth();
    const settled = rows.filter((r) => { if (r.wl === "OPEN" || r.wl === "VOID") return false; const d = new Date(r.datum); return d.getFullYear() === currentYear && d.getMonth() === currentMonth; });
    const map = new Map<number, number>();
    settled.forEach((r) => { const day = new Date(r.datum).getDate(); map.set(day, (map.get(day) ?? 0) + calcProfit(r)); });
    let cumulative = 0; const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate(); const arr: any[] = [];
    for (let d = 1; d <= daysInMonth; d++) { 
        cumulative += (map.get(d) ?? 0); 
        if (d <= now.getDate() || now.getMonth() !== currentMonth) arr.push({ dayLabel: `${d}.`, profit: cumulative }); 
    }
    return arr;
  }, [rows]);

  const chartMonthly = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const settled = rows.filter((r) => { if (r.wl === "OPEN" || r.wl === "VOID") return false; return new Date(r.datum).getFullYear() === currentYear; });
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];
    const map = new Map<number, number>();
    settled.forEach((r) => { const m = new Date(r.datum).getMonth(); map.set(m, (map.get(m) ?? 0) + calcProfit(r)); });
    return monthNames.map((name, idx) => ({ monthName: name, profit: map.get(idx) ?? 0 }));
  }, [rows]);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => map.set(r.sport || "OSTALO", (map.get(r.sport || "OSTALO") || 0) + calcRisk(r)));
    const data = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    return data.sort((a, b) => b.value - a.value);
  }, [rows]);

  const sportData = useMemo(() => SPORTI.map(s => ({ label: s, value: eur(stats.profitBySport.get(s)), profit: stats.profitBySport.get(s) ?? 0 })).sort((a,b) => b.profit - a.profit), [stats]);
  const tipsterData = useMemo(() => TIPSTERJI.map(t => ({ label: t, value: eur(stats.profitByTipster.get(t)), profit: stats.profitByTipster.get(t) ?? 0 })).sort((a,b) => b.profit - a.profit), [stats]);
  const timingData = useMemo(() => [{ label: `Prematch (${stats.prematchCount})`, value: eur(stats.profitPrematch), profit: stats.profitPrematch }, { label: `Live (${stats.liveCount})`, value: eur(stats.profitLive), profit: stats.profitLive }], [stats]);
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]"><div className="w-8 h-8 border-2 border-zinc-800 border-t-emerald-400 rounded-full animate-spin" /></div>;

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-zinc-100 font-sans pb-24 pt-44 px-4 md:px-8 lg:px-12 selection:bg-emerald-500/30">
      <div className="max-w-[1600px] mx-auto">
        
        {/* TANEK, FULL-WIDTH CITAT */}
        <div className="mb-10 w-full py-3 px-6 bg-zinc-900/40 border border-white/5 rounded-2xl shadow-lg backdrop-blur-md flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 text-center">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500/80 hidden md:block" />
          <p className="text-xs md:text-[13px] font-medium text-zinc-300 italic tracking-wide">
            "{quote.text}"
          </p>
          <span className="text-[9px] text-emerald-500 font-black uppercase tracking-[0.2em] md:ml-2">
            — {quote.author}
          </span>
        </div>

        {/* 4 GLAVNE INVESTICIJSKE METRIKE */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          <MetricCard title="Trenutna Banka" value={eur(stats.bankroll)} trend={stats.bankroll >= CAPITAL_TOTAL ? "up" : "down"} icon={<Wallet className="w-5 h-5"/>} isPositive={stats.bankroll >= CAPITAL_TOTAL} subtitle={`Začetni kapital: ${eur(CAPITAL_TOTAL)}`} />
          <MetricCard title="Skupni Profit" value={eur(stats.profit)} trend={stats.profit >= 0 ? "up" : "down"} icon={<TrendingUp className="w-5 h-5"/>} isPositive={stats.profit >= 0} subtitle="Ustvarjen čisti dobiček" />
          <MetricCard title="Yield (ROI)" value={`${stats.yieldPercent.toFixed(2)}%`} trend={stats.yieldPercent >= 0 ? "up" : "down"} icon={<Target className="w-5 h-5"/>} isPositive={stats.yieldPercent >= 0} subtitle="Profit glede na obrnjen denar" />
          <MetricCard title="Donos na Kapital" value={`${stats.donosNaKapital.toFixed(2)}%`} trend={stats.donosNaKapital >= 0 ? "up" : "down"} icon={<Landmark className="w-5 h-5"/>} isPositive={stats.donosNaKapital >= 0} subtitle="Rast osnovne investicije (8.500€)" />
        </div>

        {/* 3 SEKUNDARNE METRIKE IN FORMA */}
        <div className="grid grid-cols-3 gap-5 mb-10 max-w-4xl mx-auto">
          <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 flex flex-col justify-center items-center text-center gap-1.5 shadow-lg backdrop-blur-sm transition-all hover:bg-zinc-900/60">
            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Skupaj Stav</span>
            <span className="font-mono text-xl md:text-2xl font-black">{stats.n}</span>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-3xl p-5 flex flex-col justify-center items-center text-center gap-1.5 shadow-[0_0_20px_-10px_rgba(16,185,129,0.2)] backdrop-blur-sm transition-all hover:bg-emerald-900/20">
            <span className="text-[10px] text-emerald-500/70 uppercase font-black tracking-widest">Win Rate</span>
            <span className="font-mono text-xl md:text-2xl font-black text-emerald-400">{stats.winRate.toFixed(1)}%</span>
          </div>
          <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 flex flex-col justify-center items-center text-center gap-2.5 shadow-lg backdrop-blur-sm transition-all hover:bg-zinc-900/60">
            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Forma (Zadnjih 5)</span>
            <div className="flex gap-1.5">
              {stats.recentForm.length > 0 ? stats.recentForm.map((result, i) => (
                <div key={i} className={`flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-full text-[10px] font-black ${result === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                  {result}
               </div>
              )) : <span className="text-xs text-zinc-600">Ni podatkov</span>}
            </div>
          </div>
        </div>

        {/* GRAFI IN BANKA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-xl backdrop-blur-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                   <Clock className="w-4 h-4 text-emerald-500"/> Dnevno Gibanje (Ta Mesec)
                </h3>
              </div>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDaily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorProfitLine" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="dayLabel" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `€${v}`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fill="url(#colorProfitLine)" activeDot={{ r: 6, fill: '#10b981', stroke: '#000', strokeWidth: 2 }} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-900/40 border border-white/5 rounded-[2rem] p-6 md:p-8 shadow-xl backdrop-blur-sm">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2 mb-6"><CalendarDays className="w-4 h-4 text-emerald-500"/> Mesečni Profit</h3>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartMonthly} margin={{ top: 15, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="monthName" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="profit" position="top" fill="#a1a1aa" fontSize={10} fontWeight="bold" formatter={(v:number) => eur(v)} />
                        {chartMonthly.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#10b981" : "#f43f5e"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-white/5 rounded-[2rem] p-6 md:p-8 shadow-xl backdrop-blur-sm">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2 mb-4"><PieIcon className="w-4 h-4 text-emerald-500"/> Vložek po Športih</h3>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                        {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend layout="vertical" verticalAlign="middle" align="right" iconSize={12} wrapperStyle={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col h-full shadow-xl backdrop-blur-sm">
            <div className="p-8 border-b border-white/5 bg-black/40 text-center flex flex-col items-center">
              <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Stanje po Stavnicah</span>
              <div className="font-mono text-4xl font-black mt-3 text-zinc-100">{eur(stats.balanceByBook.reduce((a,b) => a+b.balance, 0))}</div>
            </div>
            <div className="p-5 flex flex-col gap-2.5 flex-1 overflow-y-auto">
              {stats.balanceByBook.map((book) => {
                 const width = (book.balance / Math.max(...stats.balanceByBook.map(b => b.balance))) * 100;
                 const isPos = book.balance >= book.start;
                 return (
                   <div key={book.name} className="relative flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.02] overflow-hidden group hover:bg-white/[0.04] transition-colors">
                     <div className={`absolute left-0 top-0 bottom-0 opacity-[0.15] transition-all duration-500 ${isPos ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${width}%` }} />
                     <span className="relative z-10 text-[11px] font-black text-zinc-300 tracking-widest uppercase">{book.name}</span>
                     <div className="relative z-10 text-right flex flex-col items-end">
                       <span className="font-mono text-[16px] font-black text-white">{eur(book.balance)}</span>
                       <span className={`text-[10px] font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                         {isPos ? '+' : ''}{eur(book.profit)}
                       </span>
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DataTable title="Po športih" data={sportData} icon={<Activity className="w-4 h-4 text-emerald-400" />} />
          <DataTable title="Po tipsterjih" data={tipsterData} icon={<Users className="w-4 h-4 text-violet-400" />} />
          <DataTable title="Po času" data={timingData} icon={<Clock className="w-4 h-4 text-amber-400" />} />
        </div>
      </div>
    </main>
  );
}