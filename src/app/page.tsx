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
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine, // <--- TUKAJ JE BIL MANJKAJOČI IMPORT
  LabelList
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Trophy,
  BarChart3,
  Users,
  Activity,
  Zap,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Layers
} from "lucide-react";

// --- TIPOVI IN KONSTANTE ---

type WL = "OPEN" | "WIN" | "LOSS" | "VOID" | "BACK WIN" | "LAY WIN";

type Bet = {
  id: string;
  datum: string;
  wl: WL;
  kvota1: number;
  vplacilo1: number;
  lay_kvota: number;
  vplacilo2: number; // LIABILITY
  komisija: number;
  sport: string;
  cas_stave: string;
  tipster: string;
  stavnica: string;
  mode?: "BET" | "TRADING" | null;
};

const CAPITAL_TOTAL = 8500;
const BOOK_START: Record<string, number> = {
  SHARP: 1500,
  PINNACLE: 2000,
  BET365: 2000,
  WINAMAX: 1000,
  WWIN: 500,
  "E-STAVE": 500,
  "BET AT HOME": 1000,
};

const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"];
const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"];

// --- POMOŽNE FUNKCIJE ---

function normBook(x: string) {
  return (x || "").toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}

function eur(n: number) {
  return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function eurDec(n: number) {
  return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hasLay(b: Bet) {
  return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0;
}

function hasBack(b: Bet) {
  return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0;
}

function calcProfit(b: Bet): number {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;

  const komZnesek = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0;
  const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0; 
  const layOdds = b.lay_kvota || 0;
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;

  let brutoProfit = 0;

  if (hasBack(b) && hasLay(b)) {
    const profitIfBackWins = (backStake * (backOdds - 1)) - layLiability;
    const profitIfLayWins = layStake - backStake;
    if (b.wl === "BACK WIN") brutoProfit = profitIfBackWins;
    else if (b.wl === "LAY WIN") brutoProfit = profitIfLayWins;
    else if (b.wl === "WIN") brutoProfit = Math.max(profitIfBackWins, profitIfLayWins);
    else if (b.wl === "LOSS") brutoProfit = Math.min(profitIfBackWins, profitIfLayWins);
  }
  else if (!hasBack(b) && hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") brutoProfit = layStake;
    else if (b.wl === "LOSS" || b.wl === "BACK WIN") brutoProfit = -layLiability;
  }
  else if (hasBack(b) && !hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") brutoProfit = backStake * (backOdds - 1);
    else if (b.wl === "LOSS" || b.wl === "LAY WIN") brutoProfit = -backStake;
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
  const totalRisk = settled.reduce((acc, r) => acc + calcRisk(r), 0);
  const roiPercent = totalRisk === 0 ? 0 : (profit / totalRisk) * 100;
  const donosNaKapital = ((bankroll - CAPITAL_TOTAL) / CAPITAL_TOTAL) * 100;
  const winRate = n > 0 ? (wins / n) * 100 : 0;

  const profitByBook = new Map<string, number>();
  settled.forEach((r) => {
    const key = normBook(r.stavnica || "NEZNANO");
    profitByBook.set(key, (profitByBook.get(key) ?? 0) + calcProfit(r));
  });

  const balanceByBook: { name: string; start: number; profit: number; balance: number }[] = [];
  Object.entries(BOOK_START).forEach(([name, start]) => {
    const normalizedName = normBook(name);
    const p = profitByBook.get(normalizedName) ?? 0;
    balanceByBook.push({ name, start, profit: p, balance: start + p });
  });

  profitByBook.forEach((p, key) => {
    const exists = Object.keys(BOOK_START).some((name) => normBook(name) === key);
    if (!exists) {
      balanceByBook.push({ name: key, start: 0, profit: p, balance: p });
    }
  });

  balanceByBook.sort((a, b) => b.balance - a.balance);

  const profitBySport = new Map<string, number>();
  SPORTI.forEach((sport) => profitBySport.set(sport, 0));
  settled.forEach((r) => {
    const key = r.sport || "OSTALO";
    profitBySport.set(key, (profitBySport.get(key) ?? 0) + calcProfit(r));
  });

  const profitByTipster = new Map<string, number>();
  TIPSTERJI.forEach((tipster) => profitByTipster.set(tipster, 0));
  settled.forEach((r) => {
    const key = r.tipster || "NEZNANO";
    profitByTipster.set(key, (profitByTipster.get(key) ?? 0) + calcProfit(r));
  });

  const prematch = settled.filter((r) => r.cas_stave === "PREMATCH");
  const live = settled.filter((r) => r.cas_stave === "LIVE");
  const profitPrematch = prematch.reduce((acc, r) => acc + calcProfit(r), 0);
  const profitLive = live.reduce((acc, r) => acc + calcProfit(r), 0);

  return {
    profit,
    bankroll,
    donosNaKapital,
    roiPercent,
    n,
    wins,
    losses,
    winRate,
    balanceByBook,
    profitBySport,
    profitByTipster,
    profitPrematch,
    profitLive,
    prematchCount: prematch.length,
    liveCount: live.length,
  };
}

// --- KOMPONENTE UI ---

function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  accentColor = "emerald",
  big = false,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  accentColor?: "emerald" | "amber" | "rose" | "indigo" | "violet";
  big?: boolean;
}) {
  const styles = {
    emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "shadow-emerald-500/10" },
    amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "shadow-amber-500/10" },
    rose: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", glow: "shadow-rose-500/10" },
    indigo: { text: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", glow: "shadow-indigo-500/10" },
    violet: { text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", glow: "shadow-violet-500/10" },
  };

  const currentStyle = styles[accentColor];

  return (
    <div className={`relative group overflow-hidden rounded-2xl bg-[#13151b]/80 backdrop-blur-xl border border-white/5 p-6 transition-all duration-300 hover:border-white/10 hover:shadow-2xl hover:shadow-${accentColor}-900/20 hover:-translate-y-1`}>
      <div className={`absolute top-0 right-0 w-32 h-32 ${currentStyle.bg} blur-[60px] rounded-full opacity-20 group-hover:opacity-40 transition-opacity`} />
      <div className="relative z-10">
        <div className="flex items-center justify-center mb-4">
          <div className={`p-2 rounded-xl ${currentStyle.bg} border ${currentStyle.border} ${currentStyle.text}`}>
            {icon}
          </div>
          <span className="ml-3 text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-500 group-hover:text-zinc-300 transition-colors">{title}</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1">
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

function DataTable({
  title,
  data,
  icon,
}: {
  title: string;
  data: { label: string; value: string; profit: number }[];
  icon?: React.ReactNode;
}) {
  const maxProfit = Math.max(...data.map((d) => Math.abs(d.profit)));

  return (
    <div className="rounded-2xl bg-[#13151b]/60 border border-white/5 backdrop-blur-md overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3 bg-white/[0.02]">
        <div className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 border border-white/5">{icon}</div>
        <h3 className="text-xs font-bold tracking-[0.15em] uppercase text-zinc-300">{title}</h3>
      </div>
      <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1">
        {data.map((item, idx) => {
          const barWidth = maxProfit > 0 ? (Math.abs(item.profit) / maxProfit) * 100 : 0;
          const isPositive = item.profit >= 0;
          return (
            <div key={idx} className="relative flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-white/5 transition-all group">
              <div className={`absolute left-0 bottom-0 top-0 opacity-10 transition-all duration-700 rounded-r-xl ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${barWidth}%` }} />
              <div className="flex items-center gap-3 relative z-10">
                <div className={`w-1.5 h-1.5 rounded-full ${isPositive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"}`} />
                <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">{item.label}</span>
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
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      await loadRows();
    })();
  }, [router]);

  async function loadRows() {
    setLoading(true);
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: true });
    setLoading(false);
    if (error) return;
    setRows((data ?? []) as Bet[]);
  }

  const stats = useMemo(() => buildStats(rows), [rows]);

  // --- DNEVNI GRAF (KUMULATIVNO OD 1. JAN) ---
  const chartDaily = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const settled = rows.filter((r) => {
      if (r.wl === "OPEN" || r.wl === "VOID") return false;
      const d = new Date(r.datum);
      return d.getFullYear() === currentYear;
    });

    const dailyMap = new Map<string, number>();
    settled.forEach((r) => {
      const dateKey = r.datum; // "YYYY-MM-DD"
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + calcProfit(r));
    });

    const sortedDates = Array.from(dailyMap.keys()).sort();

    let cumulative = 0;
    const chartData = sortedDates.map(date => {
        cumulative += dailyMap.get(date) || 0;
        return {
            date: new Date(date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' }),
            rawDate: date,
            profit: cumulative
        };
    });

    if (chartData.length > 0) {
        if (chartData[0].rawDate > `${currentYear}-01-01`) {
            chartData.unshift({ date: "1. Jan", rawDate: `${currentYear}-01-01`, profit: 0 });
        }
    } else {
        chartData.push({ date: "1. Jan", rawDate: `${currentYear}-01-01`, profit: 0 });
    }

    return chartData;
  }, [rows]);

  // --- MESEČNI GRAF (STOLPCI) ---
  const chartMonthly = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const settled = rows.filter((r) => {
      if (r.wl === "OPEN" || r.wl === "VOID") return false;
      const d = new Date(r.datum);
      return d.getFullYear() === currentYear;
    });

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];
    const monthProfit = new Map<number, number>();
    for(let i=0; i<12; i++) monthProfit.set(i, 0);

    settled.forEach((r) => {
      const month = new Date(r.datum).getMonth();
      monthProfit.set(month, (monthProfit.get(month) ?? 0) + calcProfit(r));
    });

    return monthNames.map((name, idx) => {
      return { monthName: name, profit: monthProfit.get(idx) ?? 0 };
    });
  }, [rows]);

  const currentMonthName = new Date().toLocaleDateString("sl-SI", { month: "long", year: "numeric" });
  const currentYearName = new Date().getFullYear();

  const sportData = useMemo(() => SPORTI.map((s) => ({ label: s, value: eur(stats.profitBySport.get(s) ?? 0), profit: stats.profitBySport.get(s) ?? 0 })).sort((a, b) => b.profit - a.profit), [stats]);
  const tipsterData = useMemo(() => TIPSTERJI.map((t) => ({ label: t, value: eur(stats.profitByTipster.get(t) ?? 0), profit: stats.profitByTipster.get(t) ?? 0 })).sort((a, b) => b.profit - a.profit), [stats]);
  const timingData = useMemo(() => [{ label: `Prematch (${stats.prematchCount})`, value: eur(stats.profitPrematch), profit: stats.profitPrematch }, { label: `Live (${stats.liveCount})`, value: eur(stats.profitLive), profit: stats.profitLive }], [stats]);

  const skupnaBanka = stats.balanceByBook.reduce((a, b) => a + b.balance, 0);
  const skupnaBankaIsUp = skupnaBanka >= CAPITAL_TOTAL;
  const profitIsUp = stats.profit >= 0;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0f1117]"><div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_20px_rgba(16,185,129,0.2)]" /></div>;

  return (
    <main className="min-h-screen bg-[#0f1117] text-white antialiased selection:bg-emerald-500/30 font-sans">
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none z-0" />
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none z-0 mix-blend-screen opacity-50" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none z-0 mix-blend-screen opacity-50" />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>

      {/* --- PADDING PT-48 --- */}
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 pt-48 pb-12 z-10">
        
        {/* TOP METRICS GRID */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard title="Začetni kapital" value={eur(CAPITAL_TOTAL)} icon={<DollarSign className="w-5 h-5" />} accentColor="indigo" big />
          <MetricCard title="Trenutno stanje" value={eur(stats.bankroll)} trend={stats.bankroll >= CAPITAL_TOTAL ? "up" : "down"} icon={<Wallet className="w-5 h-5" />} accentColor={stats.bankroll >= CAPITAL_TOTAL ? "emerald" : "rose"} big />
          <MetricCard title="Celoten profit" value={eur(stats.profit)} trend={stats.profit >= 0 ? "up" : "down"} icon={<TrendingUp className="w-5 h-5" />} accentColor={stats.profit >= 0 ? "emerald" : "rose"} big />
          <MetricCard title="Donos" value={`${stats.donosNaKapital.toFixed(2)}%`} trend={stats.donosNaKapital >= 0 ? "up" : "down"} icon={<BarChart3 className="w-5 h-5" />} accentColor="amber" big />
        </section>

        {/* SECONDARY METRICS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-[#13151b]/40 backdrop-blur-md rounded-xl border border-white/5 p-4 flex items-center justify-between group hover:border-emerald-500/30 transition-all"><div><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Stave</p><p className="text-xl font-mono font-bold text-white mt-1">{stats.n}</p></div><div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Activity className="w-4 h-4"/></div></div>
          <div className="bg-[#13151b]/40 backdrop-blur-md rounded-xl border border-white/5 p-4 flex items-center justify-between group hover:border-emerald-500/30 transition-all"><div><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Zmage</p><p className="text-xl font-mono font-bold text-emerald-400 mt-1">{stats.wins}</p></div><div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Trophy className="w-4 h-4"/></div></div>
          <div className="bg-[#13151b]/40 backdrop-blur-md rounded-xl border border-white/5 p-4 flex items-center justify-between group hover:border-rose-500/30 transition-all"><div><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Porazi</p><p className="text-xl font-mono font-bold text-rose-400 mt-1">{stats.losses}</p></div><div className="p-2 bg-rose-500/10 rounded-lg text-rose-400"><ArrowDownRight className="w-4 h-4"/></div></div>
          <div className="bg-[#13151b]/40 backdrop-blur-md rounded-xl border border-white/5 p-4 flex items-center justify-between group hover:border-violet-500/30 transition-all"><div><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Win Rate</p><p className="text-xl font-mono font-bold text-violet-400 mt-1">{stats.winRate.toFixed(1)}%</p></div><div className="p-2 bg-violet-500/10 rounded-lg text-violet-400"><Zap className="w-4 h-4"/></div></div>
        </section>

        {/* MAIN CONTENT SPLIT */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
          
          {/* LEFT: CHARTS (2/3 width) */}
          <div className="xl:col-span-2 flex flex-col gap-8">
            {/* Daily Chart */}
            <div className="relative bg-[#13151b]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div><h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-500"/> Tekoči Profit</h3><p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{currentYearName}</p></div>
                <div className="text-right"><p className="text-xs text-zinc-400">Trenutno</p><p className={`text-lg font-mono font-bold ${stats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eur(stats.profit)}</p></div>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDaily}>
                    <defs><linearGradient id="colorProfitDaily" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} dx={-10} />
                    <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }} itemStyle={{ color: "#fff", fontWeight: "bold" }} formatter={(value: any) => [eur(value), "Kumulativno"]} />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfitDaily)" activeDot={{ r: 6, strokeWidth: 0, fill: "#fff", shadow: "0 0 10px #10b981" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Chart (BAR CHART) */}
            <div className="relative bg-[#13151b]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div><h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-500"/> Mesečni Profit</h3><p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{currentYearName}</p></div>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMonthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="monthName" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} dx={-10} />
                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px" }} itemStyle={{ color: "#fff", fontWeight: "bold" }} formatter={(value: any) => [eur(value), "Profit"]} />
                    <ReferenceLine y={0} stroke="#52525b" />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                      {chartMonthly.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#10b981" : "#f43f5e"} />))}
                      <LabelList dataKey="profit" position="top" formatter={(val: number) => val !== 0 ? eur(val) : ""} style={{ fill: "#9ca3af", fontSize: "10px", fontWeight: "bold" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* RIGHT: BOOKMAKERS (1/3 width) */}
          <div className="bg-[#13151b]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col h-full shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2"><Wallet className="w-4 h-4 text-amber-500"/> Stanje Stavnic</h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
               <div className="bg-zinc-900/50 rounded-xl p-3 border border-white/5 text-center"><span className="text-[9px] text-zinc-500 uppercase tracking-wider">Skupaj</span><p className={`text-sm font-mono font-bold mt-1 ${skupnaBankaIsUp ? 'text-emerald-400' : 'text-rose-400'}`}>{eur(skupnaBanka)}</p></div>
               <div className="bg-zinc-900/50 rounded-xl p-3 border border-white/5 text-center"><span className="text-[9px] text-zinc-500 uppercase tracking-wider">Profit</span><p className={`text-sm font-mono font-bold mt-1 ${profitIsUp ? 'text-emerald-400' : 'text-rose-400'}`}>{eur(stats.profit)}</p></div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
               {stats.balanceByBook.map((book) => {
                  const isPositive = book.profit >= 0;
                  return (
                     <div key={book.name} className="relative group bg-zinc-900/30 hover:bg-zinc-900/60 border border-white/5 rounded-2xl p-4 transition-all duration-300">
                        <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-white">{book.name}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{isPositive ? "+" : ""}{eur(book.profit)}</span></div>
                        <div className="flex justify-between items-end"><div><p className="text-[9px] text-zinc-500 uppercase">Start</p><p className="text-xs text-zinc-400 font-mono">{eur(book.start)}</p></div><div className="text-right"><p className="text-[9px] text-zinc-500 uppercase">Balance</p><p className={`text-sm font-mono font-bold ${isPositive ? 'text-white' : 'text-rose-200'}`}>{eur(book.balance)}</p></div></div>
                        <div className="mt-3 h-1 w-full bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'} opacity-50`} style={{ width: `${Math.min((book.balance / (book.start * 2 || 100)) * 100, 100)}%` }}></div></div>
                     </div>
                  )
               })}
            </div>
          </div>
        </section>

        {/* DATA TABLES GRID */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DataTable title="Po športih" data={sportData} icon={<Activity className="w-4 h-4 text-emerald-400" />} />
          <DataTable title="Po tipsterjih" data={tipsterData} icon={<Users className="w-4 h-4 text-indigo-400" />} />
          <DataTable title="Po času" data={timingData} icon={<Clock className="w-4 h-4 text-amber-400" />} />
        </section>

        <footer className="mt-12 pt-8 border-t border-white/5 text-center flex flex-col md:flex-row justify-between items-center text-zinc-600 text-xs gap-2">
          <p className="hover:text-zinc-400 transition-colors">© 2024 DDTips Analytics. Premium Dashboard.</p>
          <p className="font-mono bg-zinc-900/50 px-3 py-1 rounded-full border border-white/5">Last sync: {mounted ? new Date().toLocaleTimeString() : "--:--:--"}</p>
        </footer>
      </div>
    </main>
  );
}