"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  Activity,
  Zap,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PieChart as PieIcon,
  Hash,
  Trophy,
  CalendarDays,
  Users,
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
const PIE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#0ea5e9", "#ec4899", "#8b5cf6", "#64748b"];

// --- POMOŽNE FUNKCIJE ---
function normBook(x: string) { return (x || "").toUpperCase().replace(/\s+/g, "").replace(/-/g, ""); }
function eur(n: number | undefined | null) { 
  const val = n ?? 0;
  return val.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }); 
}
function eurDec(n: number | undefined | null) { 
  const val = n ?? 0;
  return val.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}
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
  if (brutoProfit > 0) return brutoProfit - komZnesek;
  return brutoProfit;
}

function calcRisk(b: Bet): number {
    const hasBackBet = hasBack(b);
    const hasLayBet = hasLay(b);
    const backStake = b.vplacilo1 || 0;
    const layLiability = b.vplacilo2 || 0;
    if (hasBackBet && !hasLayBet) return backStake;
    if (!hasBackBet && hasLayBet) return layLiability;
    if (hasBackBet && hasLayBet) return Math.max(backStake, layLiability);
    return 0;
}

function buildStats(rows: Bet[]) {
  const settled = rows.filter((r) => r.wl !== "OPEN" && r.wl !== "VOID");
  const n = settled.length;
  const wins = settled.filter((r) => r.wl === "WIN" || r.wl === "BACK WIN" || r.wl === "LAY WIN").length;
  const losses = settled.filter((r) => r.wl === "LOSS").length;
  const profit = settled.reduce((acc, r) => acc + calcProfit(r), 0);
  const bankroll = CAPITAL_TOTAL + profit;
  const donosNaKapital = ((bankroll - CAPITAL_TOTAL) / CAPITAL_TOTAL) * 100;
  const winRate = n > 0 ? (wins / n) * 100 : 0;

  const profitByBook = new Map<string, number>();
  settled.forEach((r) => { const key = normBook(r.stavnica || "NEZNANO"); profitByBook.set(key, (profitByBook.get(key) ?? 0) + calcProfit(r)); });
  const balanceByBook: { name: string; start: number; profit: number; balance: number }[] = [];
  Object.entries(BOOK_START).forEach(([name, start]) => { const normalizedName = normBook(name); const p = profitByBook.get(normalizedName) ?? 0; balanceByBook.push({ name, start, profit: p, balance: start + p }); });
  balanceByBook.sort((a, b) => b.balance - a.balance);

  const profitBySport = new Map<string, number>();
  SPORTI.forEach((sport) => profitBySport.set(sport, 0));
  settled.forEach((r) => { const key = r.sport || "OSTALO"; profitBySport.set(key, (profitBySport.get(key) ?? 0) + calcProfit(r)); });
  const profitByTipster = new Map<string, number>();
  TIPSTERJI.forEach((tipster) => profitByTipster.set(tipster, 0));
  settled.forEach((r) => { const key = r.tipster || "NEZNANO"; profitByTipster.set(key, (profitByTipster.get(key) ?? 0) + calcProfit(r)); });
  
  const prematch = settled.filter((r) => r.cas_stave === "PREMATCH");
  const live = settled.filter((r) => r.cas_stave === "LIVE");
  
  const prematchCount = prematch.length;
  const liveCount = live.length;
  const profitPrematch = prematch.reduce((acc, r) => acc + calcProfit(r), 0);
  const profitLive = live.reduce((acc, r) => acc + calcProfit(r), 0);

  return { profit, bankroll, donosNaKapital, n, wins, losses, winRate, balanceByBook, profitBySport, profitByTipster, prematchCount, liveCount, profitPrematch, profitLive };
}

// --- KOMPONENTE UI ---

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0];
    const value = dataPoint.value;
    const title = dataPoint.name || label;
    const isProfitChart = dataPoint.name === 'profit' || title === 'Profit';
    
    return (
      <div className="glass-tooltip">
        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-2 border-b border-white/10 pb-1">{title}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-300 font-medium">{isProfitChart ? "Profit:" : "Volume:"}</span>
          <span className={`text-sm font-mono font-black ${isProfitChart ? (value >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-white'}`}>
            {isProfitChart && value > 0 ? "+" : ""}{eurDec(value)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

function MetricCard({ title, value, subtitle, trend, icon, accentColor = "emerald", big = false }: any) {
  const glowColors: Record<string, string> = {
    emerald: "rgba(16, 185, 129, 0.15)",
    amber: "rgba(245, 158, 11, 0.15)",
    rose: "rgba(244, 63, 94, 0.15)",
    indigo: "rgba(99, 102, 241, 0.15)",
    violet: "rgba(139, 92, 246, 0.15)",
  };

  const iconColors: Record<string, string> = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    indigo: "text-indigo-400",
    violet: "text-violet-400",
  };

  return (
    <div 
      className="glass-card group p-6"
      style={{ "--glow-color": glowColors[accentColor] || glowColors.emerald } as React.CSSProperties}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-xl bg-white/5 border border-white/10 ${iconColors[accentColor] || iconColors.emerald}`}>
            {icon}
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 group-hover:text-zinc-200 transition-colors">
            {title}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className={`font-mono font-bold tracking-tight text-white ${big ? "text-3xl lg:text-4xl" : "text-2xl"}`}>
              {value}
            </span>
            {trend && trend !== "neutral" && (
              <div className={`flex items-center text-sm font-bold ${trend === "up" ? "text-emerald-400" : "text-rose-400"} bg-black/30 px-1.5 py-0.5 rounded`}>
                {trend === "up" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              </div>
            )}
          </div>
          {subtitle && <p className="text-xs text-zinc-400 font-medium">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function MiniStatCard({ title, value, icon, colorClass }: any) {
  return (
    <div className="glass-card group p-4 flex items-center justify-between">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">{title}</p>
        <p className={`text-xl font-mono font-bold mt-1 ${colorClass}`}>{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>
    </div>
  );
}

function DataTable({ title, data, icon }: any) {
  const maxProfit = Math.max(...(data || []).map((d:any) => Math.abs(d.profit)));
  return (
    <div className="glass-card overflow-hidden flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3 bg-black/20">
        <div className="p-1.5 rounded-lg bg-white/5 text-zinc-400 border border-white/10">{icon}</div>
        <h3 className="text-[10px] font-bold tracking-widest uppercase text-zinc-300">{title}</h3>
      </div>
      <div className="p-3 space-y-1 overflow-y-auto custom-scrollbar flex-1">
        {data.map((item:any, idx:number) => {
          const barWidth = maxProfit > 0 ? (Math.abs(item.profit) / maxProfit) * 100 : 0;
          const isPositive = item.profit >= 0;
          return (
            <div key={idx} className="relative flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-all group overflow-hidden">
              <div className={`absolute left-0 bottom-0 top-0 opacity-10 transition-all duration-700 rounded-r-xl ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${barWidth}%` }} />
              <div className="flex items-center gap-3 relative z-10">
                <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors tracking-wide">{item.label}</span>
              </div>
              <span className={`relative z-10 text-xs font-mono font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- GLAVNA STRAN ---

export default function HomePage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkUserAndLoad = async () => {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', user.id)
        .single();

      if (profileError || !profile || !profile.is_approved) {
        router.replace("/pending");
        return;
      }

      await loadRows();
      setLoading(false);
    };

    checkUserAndLoad();
  }, [router]);

  async function loadRows() {
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: true });
    if (!error) {
        setRows((data ?? []) as Bet[]);
    }
  }

  const stats = useMemo(() => buildStats(rows), [rows]);

  const chartDaily = useMemo(() => {
    const now = new Date(); const currentYear = now.getFullYear(); const currentMonth = now.getMonth();
    const settled = rows.filter((r) => { if (r.wl === "OPEN" || r.wl === "VOID") return false; const d = new Date(r.datum); return d.getFullYear() === currentYear && d.getMonth() === currentMonth; });
    const map = new Map<number, number>();
    settled.forEach((r) => { const day = new Date(r.datum).getDate(); map.set(day, (map.get(day) ?? 0) + calcProfit(r)); });
    let cumulative = 0; const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate(); const arr: any[] = [];
    for (let d = 1; d <= daysInMonth; d++) { const daily = map.get(d) ?? 0; cumulative += daily; if (d <= now.getDate() || now.getMonth() !== currentMonth) arr.push({ day: d, dayLabel: `${d}.`, profit: cumulative }); }
    return arr;
  }, [rows]);

  const chartMonthly = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const settled = rows.filter((r) => { if (r.wl === "OPEN" || r.wl === "VOID") return false; const d = new Date(r.datum); return d.getFullYear() === currentYear; });
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];
    const monthProfit = new Map<number, number>();
    for(let i=0; i<12; i++) monthProfit.set(i, 0);
    settled.forEach((r) => { const month = new Date(r.datum).getMonth(); monthProfit.set(month, (monthProfit.get(month) ?? 0) + calcProfit(r)); });
    return monthNames.map((name, idx) => { return { monthName: name, profit: monthProfit.get(idx) ?? 0 }; });
  }, [rows]);

  const pieData = useMemo(() => {
    const sportVolume = new Map<string, number>();
    let totalRisk = 0;
    rows.forEach((r) => { 
        const risk = calcRisk(r); 
        totalRisk += risk;
        const sport = r.sport || "OSTALO"; 
        sportVolume.set(sport, (sportVolume.get(sport) || 0) + risk); 
    });
    
    const data = Array.from(sportVolume.entries()).map(([name, value]) => ({ 
        name, 
        value,
        percent: totalRisk > 0 ? (value / totalRisk) * 100 : 0
    }));
    data.sort((a, b) => b.value - a.value);
    return data;
  }, [rows]);

  const currentMonthName = new Date().toLocaleDateString("sl-SI", { month: "long", year: "numeric" });
  const sportData = useMemo(() => SPORTI.map((s) => ({ label: s, value: eur(stats.profitBySport.get(s) ?? 0), profit: stats.profitBySport.get(s) ?? 0 })).sort((a, b) => b.profit - a.profit), [stats]);
  const tipsterData = useMemo(() => TIPSTERJI.map((t) => ({ label: t, value: eur(stats.profitByTipster.get(t) ?? 0), profit: stats.profitByTipster.get(t) ?? 0 })).sort((a, b) => b.profit - a.profit), [stats]);
  
  const timingData = useMemo(() => [
      { label: `Prematch (${stats.prematchCount})`, value: eur(stats.profitPrematch), profit: stats.profitPrematch }, 
      { label: `Live (${stats.liveCount})`, value: eur(stats.profitLive), profit: stats.profitLive }
  ], [stats]);
  
  const skupnaBanka = stats.balanceByBook.reduce((a, b) => a + b.balance, 0);
  const diffFromStart = skupnaBanka - CAPITAL_TOTAL;
  const isProfit = diffFromStart >= 0;

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4 text-center p-6">
      <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">Checking Access & Loading Stats...</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30 font-sans">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />
      
      {/* Decorative Blurs */}
      <div className="fixed top-[-10%] left-[-5%] w-[400px] h-[400px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none" />

      <style jsx global>{`
        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        /* Glass Card Base Style */
        .glass-card {
          position: relative;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.08) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 25px 50px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 20px;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          overflow: hidden;
        }

        .glass-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.05),
            transparent
          );
          transition: 0.6s;
          pointer-events: none;
        }

        .glass-card:hover {
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 
            0 30px 60px rgba(0, 0, 0, 0.3),
            0 0 40px var(--glow-color, rgba(16, 185, 129, 0.1)),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          transform: translateY(-2px);
        }

        .glass-card:hover::before {
          left: 100%;
        }

        /* Glass Tooltip */
        .glass-tooltip {
          background: linear-gradient(
            135deg,
            rgba(0, 0, 0, 0.9) 0%,
            rgba(0, 0, 0, 0.8) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 12px 16px;
          border-radius: 12px;
          min-width: 140px;
        }

        /* Chart Container Glass */
        .glass-chart {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.06) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 
            0 25px 50px rgba(0, 0, 0, 0.2),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 24px;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .glass-chart:hover {
          border-color: rgba(255, 255, 255, 0.12);
          box-shadow: 
            0 30px 60px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        }
      `}</style>

      <div className="relative max-w-[1800px] mx-auto px-6 md:px-10 pt-48 pb-12 z-10">
        
        {/* KPI SEKCIJA */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard title="Začetni kapital" value={eur(CAPITAL_TOTAL)} icon={<DollarSign className="w-5 h-5" />} accentColor="indigo" big />
          <MetricCard title="Trenutno stanje" value={eur(stats.bankroll)} trend={stats.bankroll >= CAPITAL_TOTAL ? "up" : "down"} icon={<Wallet className="w-5 h-5" />} accentColor={stats.bankroll >= CAPITAL_TOTAL ? "emerald" : "rose"} big />
          <MetricCard title="Celoten profit" value={eur(stats.profit)} trend={stats.profit >= 0 ? "up" : "down"} icon={<TrendingUp className="w-5 h-5" />} accentColor={stats.profit >= 0 ? "emerald" : "rose"} big />
          <MetricCard title="Donos" value={`${stats.donosNaKapital.toFixed(2)}%`} trend={stats.donosNaKapital >= 0 ? "up" : "down"} icon={<BarChart3 className="w-5 h-5" />} accentColor="amber" big />
        </section>

        {/* SEKUNDARNI KPI */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <MiniStatCard title="Stave" value={stats.n} icon={<Hash className="w-5 h-5"/>} colorClass="text-white"/>
            <MiniStatCard title="Zmage" value={stats.wins} icon={<Trophy className="w-5 h-5"/>} colorClass="text-emerald-400"/>
            <MiniStatCard title="Porazi" value={stats.losses} icon={<ArrowDownRight className="w-5 h-5"/>} colorClass="text-rose-400"/>
            <MiniStatCard title="Win Rate" value={`${stats.winRate.toFixed(1)}%`} icon={<Zap className="w-5 h-5"/>} colorClass="text-violet-400"/>
        </section>

        {/* GRAFI IN DENARNICA */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6 items-stretch">
            
            <div className="xl:col-span-8 flex flex-col gap-6">
                <div className="glass-chart p-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-500"/> Dnevni Profit
                          </h3>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">{currentMonthName}</p>
                        </div>
                        <div className="bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                          <span className={`text-sm font-mono font-black ${stats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eur(stats.profit)}</span>
                        </div>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartDaily}>
                            <defs>
                              <linearGradient id="colorProfitDaily" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="dayLabel" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                            <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} dx={-10} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                            <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfitDaily)" activeDot={{ r: 6, strokeWidth: 0, fill: "#fff" }} />
                          </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                    <div className="glass-chart p-6 flex flex-col">
                        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                          <CalendarDays className="w-4 h-4 text-indigo-500"/> Mesečni Profit
                        </h3>
                        <div className="flex-1 min-h-[180px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartMonthly}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="monthName" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} width={40} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                                    <Bar dataKey="profit" radius={[4, 4, 4, 4]}>
                                        {chartMonthly.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#10b981" : "#f43f5e"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="glass-chart p-6 flex flex-col">
                        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                          <PieIcon className="w-4 h-4 text-violet-500"/> Volume po športih
                        </h3>
                        <div className="flex flex-row items-center h-full">
                            <div className="flex flex-col gap-2 flex-1 pr-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                                {pieData.slice(0, 5).map((entry, index) => (
                                    <div key={entry.name} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                                            <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors">{entry.name}</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-zinc-500">{entry.percent.toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                            <div className="w-[140px] h-[140px] relative shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                                            {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="xl:col-span-4 flex flex-col h-full">
                <div className="glass-card flex flex-col h-full overflow-hidden">
                    <div className="bg-black/20 p-6 border-b border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-amber-500"/> Skupno Stanje
                            </h3>
                            <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isProfit ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
                                {eur(diffFromStart)}
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-mono font-black tracking-tight ${skupnaBanka >= CAPITAL_TOTAL ? 'text-emerald-400' : 'text-rose-400'}`}>{eur(skupnaBanka)}</span>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase">/ {eur(CAPITAL_TOTAL)} Start</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-between p-4 gap-2">
                        {stats.balanceByBook.map((book) => {
                            const isPositive = book.profit >= 0;
                            const initials = book.name.substring(0, 1); 
                            return (
                                <div key={book.name} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 hover:bg-white/10 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-zinc-400 border border-white/10 group-hover:text-white group-hover:border-white/20 transition-colors">
                                            {initials}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">{book.name}</span>
                                            <div className="flex items-center gap-1">
                                                <span className={`text-[14px] font-mono ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {isPositive ? "+" : ""}{eur(book.profit)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-sm font-mono font-bold ${isPositive ? 'text-white' : 'text-rose-200'}`}>{eur(book.balance)}</span>
                                        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'} opacity-60`} 
                                                style={{ width: `${Math.min((book.balance / (book.start * 1.5 || 100)) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>

        {/* TABELE PO ŠPORTIH IN TIPSTERJIH */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DataTable title="Po športih" data={sportData} icon={<Activity className="w-4 h-4 text-emerald-400" />} />
          <DataTable title="Po tipsterjih" data={tipsterData} icon={<Users className="w-4 h-4 text-indigo-400" />} />
          <DataTable title="Po času (Profit)" data={timingData} icon={<Clock className="w-4 h-4 text-amber-400" />} />
        </section>

        <footer className="mt-12 pt-8 border-t border-white/5 text-center flex flex-col md:flex-row justify-between items-center text-zinc-500 text-xs gap-2">
          <p className="hover:text-zinc-300 transition-colors">© 2026 DDTips Analytics.</p>
          <p className="font-mono bg-white/5 px-3 py-1 rounded-full border border-white/10">Last sync: {mounted ? new Date().toLocaleTimeString() : "--:--:--"}</p>
        </footer>
      </div>
    </main>
  );
}