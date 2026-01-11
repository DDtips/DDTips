"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from "recharts";
import {
  Calendar, Filter, Users, Building2, Clock, Activity, RefreshCw, Layers,
  Target, TrendingUp, Percent, ArrowRightLeft, Hash, Scale, ChevronDown, Check,
  Wallet, Trophy, ArrowDownRight, ArrowUpRight
} from "lucide-react";

// --- TIPOVI ---
type WL = "OPEN" | "WIN" | "LOSS" | "VOID" | "BACK WIN" | "LAY WIN";
type Cas = "PREMATCH" | "LIVE";
type Mode = "BET" | "TRADING";

type Bet = {
  id: string;
  datum: string;
  wl: WL;
  kvota1: number;
  vplacilo1: number;
  lay_kvota: number;
  vplacilo2: number;
  komisija: number;
  sport: string;
  cas_stave: Cas;
  tipster: string;
  stavnica: string;
  dogodek?: string;
  tip?: string;
  mode?: Mode | null;
};

// --- KONSTANTE ---
const BOOK_START: Record<string, number> = {
  SHARP: 2000, PINNACLE: 2000, BET365: 2000, WINAMAX: 1000, WWIN: 500, "E-STAVE": 500, "BET AT HOME": 1000,
};
const TOTAL_START_BANK = Object.values(BOOK_START).reduce((a, b) => a + b, 0);
const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"];
const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"];
const STAVNICE = ["SHARP", "PINNACLE", "BET365", "WINAMAX", "WWIN", "BET AT HOME", "E-STAVE"];

// --- POMOŽNE FUNKCIJE ---
function eur(n: number) {
  return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function eurDec(n: number) {
  return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hasLay(b: Bet) { return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0; }
function hasBack(b: Bet) { return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0; }
function getMode(b: Bet): Mode { if (b.mode) return b.mode; return hasBack(b) && hasLay(b) ? "TRADING" : "BET"; }

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

// Funkcija za sestavo statistike
function buildStats(rows: Bet[], filteredRows: Bet[], isFilteredByDate: boolean) {
  const settled = filteredRows.filter((r) => r.wl !== "OPEN" && r.wl !== "VOID");
  const n = settled.length;
  const wins = settled.filter((r) => r.wl === "WIN" || r.wl === "BACK WIN" || r.wl === "LAY WIN").length;
  const losses = settled.filter((r) => r.wl === "LOSS").length;
  const profit = settled.reduce((acc, r) => acc + calcProfit(r), 0);
  const totalRisk = settled.reduce((acc, r) => acc + calcRisk(r), 0);
  
  const roi = totalRisk === 0 ? 0 : (profit / totalRisk) * 100;
  const winRate = n > 0 ? (wins / n) * 100 : 0;
  const growth = (profit / TOTAL_START_BANK) * 100;
  const avgOdds = n > 0 ? settled.reduce((acc, r) => acc + (r.kvota1 || 0), 0) / n : 0;

  const preProfit = settled.filter(r => r.cas_stave === "PREMATCH").reduce((acc, r) => acc + calcProfit(r), 0);
  const liveProfit = settled.filter(r => r.cas_stave === "LIVE").reduce((acc, r) => acc + calcProfit(r), 0);

  // --- LOGIKA ZA TEKOČI PROFIT (Running Cumulative) ---
  // 1. Določimo katere stave upoštevamo. Če ni časovnega filtra, vzamemo trenutno leto.
  let chartSourceRows = settled;
  const currentYear = new Date().getFullYear();
  
  if (!isFilteredByDate) {
      chartSourceRows = settled.filter(r => new Date(r.datum).getFullYear() === currentYear);
  }

  // 2. Združimo po dnevih (da ni cik-cak za isti dan)
  const dailyMap = new Map<string, number>();
  chartSourceRows.forEach(r => {
      const dateKey = r.datum; // YYYY-MM-DD
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + calcProfit(r));
  });

  // 3. Sortiramo po datumu
  const sortedDates = Array.from(dailyMap.keys()).sort();

  // 4. Izračunamo kumulativo
  let runningProfit = 0;
  const chartData = sortedDates.map(date => {
      runningProfit += dailyMap.get(date) || 0;
      return {
          date: new Date(date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' }),
          rawDate: date,
          profit: runningProfit,
          dailyChange: dailyMap.get(date)
      };
  });

  // Če je graf prazen (začetek leta), dodamo začetno točko 0
  if (chartData.length === 0 && !isFilteredByDate) {
      chartData.push({ date: "1. Jan", rawDate: `${currentYear}-01-01`, profit: 0, dailyChange: 0 });
  }

  // --- MESEČNI BAR CHART ---
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];
  // Za mesečni graf vedno gledamo tekoče leto (razen če je filter drugačen, ampak pustimo default year)
  const monthlyRows = isFilteredByDate ? settled : rows.filter(r => new Date(r.datum).getFullYear() === currentYear && r.wl !== "OPEN" && r.wl !== "VOID");
  
  const monthlyData = monthNames.map((name, index) => {
      const monthProfit = monthlyRows
          .filter(r => new Date(r.datum).getMonth() === index)
          .reduce((acc, r) => acc + calcProfit(r), 0);
      return { month: name, profit: monthProfit };
  });

  return { profit, n, wins, losses, roi, winRate, growth, avgOdds, chartData, monthlyData, settled, preProfit, liveProfit };
}

function getBreakdown(rows: Bet[], key: 'tipster' | 'sport' | 'cas_stave') {
  const groups = new Set(rows.map(r => r[key]).filter(Boolean));
  const data = Array.from(groups).map(item => {
    const itemRows = rows.filter(r => r[key] === item);
    const bettingRows = itemRows.filter(r => getMode(r) === "BET");
    const tradingRows = itemRows.filter(r => getMode(r) === "TRADING");

    const bettingProfit = bettingRows.reduce((acc, r) => acc + calcProfit(r), 0);
    const tradingProfit = tradingRows.reduce((acc, r) => acc + calcProfit(r), 0);
    const totalProfit = bettingProfit + tradingProfit;

    return { name: item, bettingProfit, tradingProfit, totalProfit, count: itemRows.length };
  });
  return data.sort((a, b) => b.totalProfit - a.totalProfit);
}

// --- UI KOMPONENTE ---

function MultiSelectField({ label, options, selected, onChange, icon }: { label: string, options: string[], selected: string[], onChange: (val: string[]) => void, icon?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
    else onChange([...selected, opt]);
  };

  return (
    <div className="space-y-1.5 relative pointer-events-auto" ref={dropdownRef}>
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500">{icon} {label}</label>
      <button onClick={() => setIsOpen(!isOpen)} className="w-full px-3 py-2.5 bg-[#13151b] border border-zinc-800 rounded-xl text-zinc-200 text-xs flex items-center justify-between hover:border-emerald-500/50 hover:bg-[#1a1d24] transition-all shadow-sm">
        <span className="truncate font-medium">{selected.length === 0 ? "Vsi" : selected.length === 1 ? selected[0] : `${selected.length} izbrano`}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-[#13151b] border border-zinc-800 rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
           {options.map(opt => {
             const isSelected = selected.includes(opt);
             return (
               <div key={opt} onClick={() => toggleOption(opt)} className={`px-3 py-2.5 text-xs flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors border-l-2 ${isSelected ? "border-emerald-500 bg-emerald-500/5 text-emerald-400 font-bold" : "border-transparent text-zinc-400"}`}>
                 <span>{opt}</span>{isSelected && <Check className="w-3.5 h-3.5" />}
               </div>
             )
           })}
        </div>
      )}
    </div>
  );
}

function StatMetric({ label, value, subValue, color = "text-white", icon, inlineSub }: any) {
  return (
    <div className="flex flex-col items-center justify-center p-3 text-center rounded-xl hover:bg-white/5 transition-colors group">
      <div className="flex items-center gap-1.5 mb-2 text-zinc-500 justify-center group-hover:text-zinc-400 transition-colors">
        {icon}<span className="text-[10px] font-bold tracking-[0.15em] uppercase">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 justify-center flex-wrap">
        <span className={`text-2xl md:text-3xl font-mono font-bold tracking-tight ${color}`}>{value}</span>
        {inlineSub && <span className="text-sm font-bold text-zinc-500">{inlineSub}</span>}
      </div>
      {subValue && !inlineSub && <span className="text-xs font-bold text-zinc-500 mt-1">{subValue}</span>}
    </div>
  );
}

function BigStatCard({ title, stats, variant = "main" }: { title: string; stats: any; variant: "main" | "betting" | "trading" }) {
  const isPositive = stats.profit >= 0;
  const profitColor = isPositive ? "text-emerald-400" : "text-rose-400";
  let gradient = "", icon = null, borderColor = "";

  if (variant === "main") { gradient = "bg-[#13151b]/80"; borderColor = "border-emerald-500/20"; icon = <Layers className="w-4 h-4 text-emerald-500" />; } 
  else if (variant === "betting") { gradient = "bg-[#13151b]/80"; borderColor = "border-sky-500/20"; icon = <Target className="w-4 h-4 text-sky-500" />; } 
  else { gradient = "bg-[#13151b]/80"; borderColor = "border-violet-500/20"; icon = <ArrowRightLeft className="w-4 h-4 text-violet-500" />; }

  return (
    <div className={`relative rounded-2xl border ${borderColor} ${gradient} backdrop-blur-xl overflow-hidden shadow-2xl transition-all hover:border-opacity-50 group`}>
      <div className={`absolute top-0 right-0 w-64 h-64 ${variant === 'main' ? 'bg-emerald-500/5' : variant === 'betting' ? 'bg-sky-500/5' : 'bg-violet-500/5'} blur-[80px] rounded-full pointer-events-none group-hover:opacity-100 transition-opacity opacity-50`} />
      <div className="p-6 relative z-10">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`p-1.5 rounded-lg bg-zinc-900 border ${borderColor}`}>{icon}</div>
          <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">{title}</h3>
        </div>
        <div className="text-center mb-8">
          <div className={`text-5xl md:text-6xl font-mono font-bold tracking-tight ${profitColor} drop-shadow-2xl`}>{eur(stats.profit)}</div>
          <div className="text-[10px] font-bold text-zinc-500 mt-2 uppercase tracking-[0.2em]">Neto Profit</div>
        </div>
        {variant !== "main" && (
           <div className="flex justify-center gap-8 mb-8 text-sm font-bold text-zinc-300 border-b border-white/5 pb-6">
              <div className="flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Prematch</span><span className={`font-mono ${stats.preProfit >=0 ? "text-emerald-400":"text-rose-400"}`}>{eur(stats.preProfit)}</span></div>
              <div className="w-px h-8 bg-zinc-800"></div>
              <div className="flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Live</span><span className={`font-mono ${stats.liveProfit >=0 ? "text-emerald-400":"text-rose-400"}`}>{eur(stats.liveProfit)}</span></div>
           </div>
        )}
        {variant === "main" && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
             <StatMetric label="Stave" value={stats.n} inlineSub={`${stats.wins}-${stats.losses}`} icon={<Hash className="w-3.5 h-3.5" />} />
             <StatMetric label="Rast" value={`${stats.growth >= 0 ? "+" : ""}${stats.growth.toFixed(1)}%`} color={stats.growth >= 0 ? "text-emerald-400" : "text-rose-400"} icon={<Percent className="w-3.5 h-3.5" />} />
             <StatMetric label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} color="text-zinc-200" icon={<Activity className="w-3.5 h-3.5" />} />
          </div>
        )}
        {variant !== "main" && (
          <div className={`grid ${variant === 'betting' ? 'grid-cols-4' : 'grid-cols-3'} gap-4 pt-4 border-t border-white/5`}>
             <StatMetric label="Stave" value={stats.n} inlineSub={`${stats.wins}-${stats.losses}`} icon={<Hash className="w-3.5 h-3.5" />} />
             <StatMetric label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} color="text-zinc-200" icon={<Activity className="w-3.5 h-3.5" />} />
             {variant === "betting" && (
               <><StatMetric label="Povp. Kvota" value={stats.avgOdds.toFixed(2)} color="text-sky-400" icon={<Target className="w-3.5 h-3.5" />} /><StatMetric label="ROI" value={`${stats.roi.toFixed(1)}%`} color={stats.roi >= 0 ? "text-emerald-400" : "text-rose-400"} icon={<TrendingUp className="w-3.5 h-3.5" />} /></>
             )}
             {variant === "trading" && (
                <StatMetric label="Rast" value={`${stats.growth >= 0 ? "+" : ""}${stats.growth.toFixed(1)}%`} color={stats.growth >= 0 ? "text-emerald-400" : "text-rose-400"} icon={<Percent className="w-3.5 h-3.5" />} />
             )}
          </div>
        )}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", icon, placeholder }: any) {
  return (
    <div className="space-y-1.5 pointer-events-auto">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500">{icon} {label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 bg-[#13151b] border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700 text-center font-medium shadow-sm hover:border-zinc-700" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, icon }: any) {
  return (
    <div className="space-y-1.5 pointer-events-auto">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500">{icon} {label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2.5 appearance-none bg-[#13151b] border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer text-center font-medium shadow-sm hover:border-zinc-700">
          {options.map((opt: string) => <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
      </div>
    </div>
  );
}

// --- GLAVNA STRAN ---
export default function StatsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // States for filters
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedTipsters, setSelectedTipsters] = useState<string[]>([]);
  const [stavnica, setStavnica] = useState("ALL");
  const [cas, setCas] = useState<"ALL" | Cas>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minKvota, setMinKvota] = useState("");
  const [maxKvota, setMaxKvota] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/login"); return; }
      await loadRows();
    })();
  }, [router]);

  async function loadRows() {
    setLoading(true);
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: true });
    setLoading(false);
    if (!error) setRows((data ?? []) as Bet[]);
  }

  // --- REFRESH FUNCTION ---
  // To počisti vse filtre in ponovno naloži podatke
  const handleRefresh = async () => {
    setSelectedSports([]);
    setSelectedTipsters([]);
    setStavnica("ALL");
    setCas("ALL");
    setFromDate("");
    setToDate("");
    setMinKvota("");
    setMaxKvota("");
    setFiltersOpen(false); // Zapri filtre, če so odprti
    await loadRows();
  };

  const handleClearFilters = () => {
    setSelectedSports([]); setSelectedTipsters([]); setStavnica("ALL"); setCas("ALL"); setFromDate(""); setToDate(""); setMinKvota(""); setMaxKvota("");
  };

  const hasActiveFilters = selectedSports.length > 0 || selectedTipsters.length > 0 || stavnica !== "ALL" || cas !== "ALL" || fromDate !== "" || toDate !== "" || minKvota !== "" || maxKvota !== "";
  const isFilteredByDate = fromDate !== "" || toDate !== "";

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedSports.length > 0 && !selectedSports.includes(r.sport)) return false;
      if (selectedTipsters.length > 0 && !selectedTipsters.includes(r.tipster)) return false;
      if (stavnica !== "ALL" && r.stavnica !== stavnica) return false;
      if (cas !== "ALL" && r.cas_stave !== cas) return false;
      if (fromDate && r.datum < fromDate) return false;
      if (toDate && r.datum > toDate) return false;
      if (getMode(r) === "BET") {
         if (minKvota && r.kvota1 < parseFloat(minKvota)) return false;
         if (maxKvota && r.kvota1 > parseFloat(maxKvota)) return false;
      }
      return true;
    });
  }, [rows, selectedSports, selectedTipsters, stavnica, cas, fromDate, toDate, minKvota, maxKvota]);

  const bettingRows = useMemo(() => filteredRows.filter(r => getMode(r) === "BET"), [filteredRows]);
  const tradingRows = useMemo(() => filteredRows.filter(r => getMode(r) === "TRADING"), [filteredRows]);

  const totalStats = useMemo(() => buildStats(rows, filteredRows, isFilteredByDate), [rows, filteredRows, isFilteredByDate]);
  const bettingStats = useMemo(() => buildStats(rows, bettingRows, isFilteredByDate), [rows, bettingRows, isFilteredByDate]);
  const tradingStats = useMemo(() => buildStats(rows, tradingRows, isFilteredByDate), [rows, tradingRows, isFilteredByDate]);

  const tipsterBreakdown = useMemo(() => getBreakdown(filteredRows, 'tipster'), [filteredRows]);
  const sportBreakdown = useMemo(() => getBreakdown(filteredRows, 'sport'), [filteredRows]);
  const casBreakdown = useMemo(() => getBreakdown(filteredRows, 'cas_stave'), [filteredRows]);

  const tipsterTotals = useMemo(() => tipsterBreakdown.reduce((acc, curr) => ({ bet: acc.bet + curr.bettingProfit, trade: acc.trade + curr.tradingProfit, total: acc.total + curr.totalProfit }), { bet: 0, trade: 0, total: 0 }), [tipsterBreakdown]);
  const sportTotals = useMemo(() => sportBreakdown.reduce((acc, curr) => ({ bet: acc.bet + curr.bettingProfit, trade: acc.trade + curr.tradingProfit, total: acc.total + curr.totalProfit }), { bet: 0, trade: 0, total: 0 }), [sportBreakdown]);
  const casTotals = useMemo(() => casBreakdown.reduce((acc, curr) => ({ bet: acc.bet + curr.bettingProfit, trade: acc.trade + curr.tradingProfit, total: acc.total + curr.totalProfit }), { bet: 0, trade: 0, total: 0 }), [casBreakdown]);

  if (loading && rows.length === 0) return <div className="min-h-screen flex items-center justify-center bg-[#0f1117]"><div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_20px_rgba(16,185,129,0.2)]" /></div>;

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

      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 pb-12 z-10">
        
        {/* FILTER BAR - LEBDEČ ZGORAJ */}
        <div className="pt-48 pb-8 flex justify-end relative z-[60] pointer-events-none">
           <div className="flex gap-3 pointer-events-auto">
            <button onClick={() => setFiltersOpen(!filtersOpen)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all cursor-pointer shadow-lg active:scale-95 backdrop-blur-md ${filtersOpen ? 'bg-emerald-500 text-black border-emerald-400 font-bold' : 'bg-[#13151b]/80 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500'}`}>
              <Filter className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-wider">Filtri</span>
              {hasActiveFilters && !filtersOpen && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>}
            </button>
            {/* GUMB REFRESH - ZDAJ ZBRIŠE VSE FILTRE IN NALOŽI DATA */}
            <button onClick={handleRefresh} className="p-2.5 bg-[#13151b]/80 text-zinc-300 border border-zinc-700 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/50 transition-all cursor-pointer shadow-lg active:scale-95 backdrop-blur-md">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-500" : ""}`} />
            </button>
          </div>
        </div>

        {/* FILTERS DROPDOWN */}
        <div className={`transition-all duration-500 ease-in-out relative z-50 ${filtersOpen ? 'opacity-100 max-h-[500px] mb-10 translate-y-0' : 'max-h-0 opacity-0 mb-0 -translate-y-4 overflow-hidden pointer-events-none'}`}>
          <div className="p-8 rounded-3xl bg-[#13151b]/90 border border-zinc-700/50 backdrop-blur-2xl shadow-2xl">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-5 mb-8">
              <InputField label="Od" value={fromDate} onChange={setFromDate} type="date" icon={<Calendar className="w-3.5 h-3.5" />} />
              <InputField label="Do" value={toDate} onChange={setToDate} type="date" icon={<Calendar className="w-3.5 h-3.5" />} />
              <MultiSelectField label="Športi" options={SPORTI} selected={selectedSports} onChange={setSelectedSports} icon={<Activity className="w-3.5 h-3.5" />} />
              <MultiSelectField label="Tipsterji" options={TIPSTERJI} selected={selectedTipsters} onChange={setSelectedTipsters} icon={<Users className="w-3.5 h-3.5" />} />
              <SelectField label="Stavnica" value={stavnica} onChange={setStavnica} options={["ALL", ...STAVNICE]} icon={<Building2 className="w-3.5 h-3.5" />} />
              <SelectField label="Čas" value={cas} onChange={setCas} options={["ALL", "PREMATCH", "LIVE"]} icon={<Clock className="w-3.5 h-3.5" />} />
              <InputField label="Min Kvota" value={minKvota} onChange={setMinKvota} placeholder="1.00" icon={<Scale className="w-3.5 h-3.5" />} />
              <InputField label="Max Kvota" value={maxKvota} onChange={setMaxKvota} placeholder="10.00" icon={<Scale className="w-3.5 h-3.5" />} />
            </div>
            <div className="flex justify-end gap-4 pt-6 border-t border-white/5">
              <button onClick={handleClearFilters} className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors cursor-pointer">Počisti vse</button>
              <button onClick={() => setFiltersOpen(false)} className="px-8 py-2.5 bg-emerald-500 text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">Prikaži Rezultate</button>
            </div>
          </div>
        </div>

        {/* --- STATISTIČNE KARTICE --- */}
        <section className="space-y-8 mb-16">
          <BigStatCard title="Skupna Statistika" stats={totalStats} variant="main" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <BigStatCard title="Betting" stats={bettingStats} variant="betting" />
            <BigStatCard title="Trading" stats={tradingStats} variant="trading" />
          </div>
        </section>

        {/* --- BREAKDOWN LISTE --- */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {/* TIPSTER BREAKDOWN */}
            <div className="rounded-3xl bg-[#13151b]/60 border border-white/5 backdrop-blur-xl p-6 flex flex-col h-full shadow-lg">
                <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4"><div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><Users className="w-4 h-4" /></div><h3 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">Tipsterji</h3></div>
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[350px] custom-scrollbar pr-2">
                    <div className="grid grid-cols-4 text-[10px] font-bold text-zinc-500 uppercase px-3 mb-2 sticky top-0 bg-[#13151b] z-10 py-2 rounded-lg"><span>Ime</span><span className="text-right text-sky-500">Bet Profit</span><span className="text-right text-violet-500">Trad Profit</span><span className="text-right text-white">Skupaj</span></div>
                    {tipsterBreakdown.map(t => (
                        <div key={t.name} className="grid grid-cols-4 text-xs px-3 py-3 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/5 group"><span className="font-bold text-zinc-300 group-hover:text-white transition-colors">{t.name} <span className="text-[9px] text-zinc-600 font-normal ml-1 bg-black/20 px-1.5 py-0.5 rounded">x{t.count}</span></span><span className={`text-right font-mono font-medium ${t.bettingProfit>=0?"text-sky-400":"text-rose-400"}`}>{eurDec(t.bettingProfit)}</span><span className={`text-right font-mono font-medium ${t.tradingProfit>=0?"text-violet-400":"text-rose-400"}`}>{eurDec(t.tradingProfit)}</span><span className={`text-right font-mono font-black ${t.totalProfit>=0?"text-emerald-400":"text-rose-400"}`}>{eurDec(t.totalProfit)}</span></div>
                    ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-4 text-xs font-black uppercase px-3 bg-black/20 py-3 rounded-xl border border-white/5"><span className="text-zinc-500">SKUPAJ</span><span className={`text-right font-mono ${tipsterTotals.bet>=0?"text-sky-400":"text-rose-400"}`}>{eurDec(tipsterTotals.bet)}</span><span className={`text-right font-mono ${tipsterTotals.trade>=0?"text-violet-400":"text-rose-400"}`}>{eurDec(tipsterTotals.trade)}</span><span className={`text-right font-mono text-emerald-400`}>{eurDec(tipsterTotals.total)}</span></div>
            </div>
            {/* SPORT BREAKDOWN */}
            <div className="rounded-3xl bg-[#13151b]/60 border border-white/5 backdrop-blur-xl p-6 flex flex-col h-full shadow-lg">
                <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4"><div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Activity className="w-4 h-4" /></div><h3 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">Športi</h3></div>
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[350px] custom-scrollbar pr-2">
                    <div className="grid grid-cols-4 text-[10px] font-bold text-zinc-500 uppercase px-3 mb-2 sticky top-0 bg-[#13151b] z-10 py-2 rounded-lg"><span>Šport</span><span className="text-right text-sky-500">Bet Profit</span><span className="text-right text-violet-500">Trad Profit</span><span className="text-right text-white">Skupaj</span></div>
                    {sportBreakdown.map(t => (
                        <div key={t.name} className="grid grid-cols-4 text-xs px-3 py-3 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/5 group"><span className="font-bold text-zinc-300 group-hover:text-white transition-colors">{t.name} <span className="text-[9px] text-zinc-600 font-normal ml-1 bg-black/20 px-1.5 py-0.5 rounded">x{t.count}</span></span><span className={`text-right font-mono font-medium ${t.bettingProfit>=0?"text-sky-400":"text-rose-400"}`}>{eurDec(t.bettingProfit)}</span><span className={`text-right font-mono font-medium ${t.tradingProfit>=0?"text-violet-400":"text-rose-400"}`}>{eurDec(t.tradingProfit)}</span><span className={`text-right font-mono font-black ${t.totalProfit>=0?"text-emerald-400":"text-rose-400"}`}>{eurDec(t.totalProfit)}</span></div>
                    ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-4 text-xs font-black uppercase px-3 bg-black/20 py-3 rounded-xl border border-white/5"><span className="text-zinc-500">SKUPAJ</span><span className={`text-right font-mono ${sportTotals.bet>=0?"text-sky-400":"text-rose-400"}`}>{eurDec(sportTotals.bet)}</span><span className={`text-right font-mono ${sportTotals.trade>=0?"text-violet-400":"text-rose-400"}`}>{eurDec(sportTotals.trade)}</span><span className={`text-right font-mono text-emerald-400`}>{eurDec(sportTotals.total)}</span></div>
            </div>
        </section>

        {/* --- GRAFI --- */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* CUMULATIVE AREA CHART */}
          <div className="lg:col-span-2 rounded-3xl bg-[#13151b]/60 border border-white/5 backdrop-blur-xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em] flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Tekoči Profit</h3>
               <div className="bg-black/20 px-3 py-1 rounded-lg border border-white/5"><span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Kumulativno</span></div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={totalStats.chartData}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} dy={10} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} dx={-10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: "#fff", fontWeight: "bold" }}
                    formatter={(value: number | undefined) => [eurDec(value || 0), "Profit"]}
                  />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" activeDot={{ r: 6, strokeWidth: 0, fill: "#fff", shadow: "0 0 10px #10b981" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* MESEČNI BAR CHART + PREMATCH/LIVE */}
          <div className="lg:col-span-1 flex flex-col gap-6">
             <div className="rounded-3xl bg-[#13151b]/60 border border-white/5 backdrop-blur-xl p-6 shadow-lg flex-1">
                <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><Clock className="w-4 h-4" /></div>
                    <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">Prematch / Live</h3>
                </div>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                       <div className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 text-center"><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Prematch</p><p className={`text-xl font-mono font-bold ${casTotals.bet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{eurDec(casTotals.bet)}</p></div>
                       <div className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 text-center"><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Live</p><p className={`text-xl font-mono font-bold ${casTotals.trade >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{eurDec(casTotals.trade)}</p></div>
                    </div>
                    <div className="bg-gradient-to-r from-zinc-900 to-black p-4 rounded-2xl border border-white/5 flex justify-between items-center px-6">
                       <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Skupaj</span>
                       <span className={`text-xl font-mono font-black ${casTotals.total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{eurDec(casTotals.total)}</span>
                    </div>
                </div>
             </div>

             <div className="rounded-3xl bg-[#13151b]/60 border border-white/5 backdrop-blur-xl p-6 shadow-lg flex-1 min-h-[200px]">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><Layers className="w-4 h-4" /></div>
                    <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">Mesečni Profit</h3>
                </div>
                <div className="h-[150px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={totalStats.monthlyData}>
                         <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px" }} itemStyle={{ color: "#fff", fontWeight: "bold" }} formatter={(value: number) => [eur(value), "Profit"]} />
                         <Bar dataKey="profit" radius={[4, 4, 4, 4]}>
                            {totalStats.monthlyData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#10b981" : "#f43f5e"} />))}
                            <LabelList dataKey="profit" position="top" formatter={(val: number) => val !== 0 ? (val > 0 ? "+" : "") + eur(val) : ""} style={{ fill: "#d4d4d8", fontSize: "10px", fontWeight: "bold", fontFamily: "monospace" }} />
                         </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
          </div>
        </section>

        {/* --- TABELA --- */}
        <section className="rounded-3xl bg-[#13151b]/60 border border-white/5 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between"><h3 className="text-xs font-bold text-white uppercase tracking-[0.2em] flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500" /> Zadnje Aktivnosti</h3><div className="text-[10px] font-bold text-zinc-500 bg-black/20 px-2 py-1 rounded border border-white/5">Zadnjih 20 stav</div></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-black/20 text-zinc-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="p-4 text-center">Datum</th><th className="p-4 text-center">Mode</th><th className="p-4 text-center">Status</th><th className="p-4 text-center w-[200px]">Dogodek</th><th className="p-4 text-center">Stavnica</th><th className="p-4 text-center">Tipster</th><th className="p-4 text-center">Kvota</th><th className="p-4 text-center">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {totalStats.settled.slice().reverse().slice(0, 20).map((row) => {
                  let statusBadge = null;
                  if(row.wl === "BACK WIN") statusBadge = <span className="px-2 py-1 rounded text-[9px] font-black border text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_10px_-3px_rgba(16,185,129,0.3)]">BACK WIN</span>;
                  else if(row.wl === "LAY WIN") statusBadge = <span className="px-2 py-1 rounded text-[9px] font-black border text-pink-400 bg-pink-500/10 border-pink-500/20 shadow-[0_0_10px_-3px_rgba(236,72,153,0.3)]">LAY WIN</span>;
                  else if(row.wl === "WIN") statusBadge = <span className="px-2 py-1 rounded text-[9px] font-bold border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">WIN</span>;
                  else if(row.wl === "LOSS") statusBadge = <span className="px-2 py-1 rounded text-[9px] font-bold border text-rose-400 bg-rose-500/10 border-rose-500/20">LOSS</span>;
                  else statusBadge = <span className="px-2 py-1 rounded text-[9px] font-bold border text-zinc-400 bg-zinc-500/10 border-zinc-500/20">{row.wl}</span>;

                  let displayKvota = row.kvota1;
                  if (getMode(row) === "TRADING" && row.wl === "LAY WIN") displayKvota = row.lay_kvota;
                  else if (hasLay(row) && !hasBack(row)) displayKvota = row.lay_kvota;

                  return (
                    <tr key={row.id} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="p-4 text-zinc-400 text-center font-mono">{new Date(row.datum).toLocaleDateString("sl-SI")}</td>
                      <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-[9px] font-bold border tracking-wider ${getMode(row) === 'TRADING' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}>{getMode(row)}</span></td>
                      <td className="p-4 text-center">{statusBadge}</td>
                      <td className="p-4 text-zinc-300 text-center font-medium group-hover:text-white transition-colors">{row.dogodek || "-"}</td>
                      <td className="p-4 text-center text-zinc-500 uppercase text-[9px] font-bold tracking-wider">{row.stavnica}</td>
                      <td className="p-4 text-center"><span className="px-2 py-1 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 text-[10px] font-bold">{row.tipster}</span></td>
                      <td className="p-4 text-center text-zinc-300 font-mono font-bold">{displayKvota > 0 ? displayKvota.toFixed(2) : "-"}</td>
                      <td className={`p-4 text-center font-mono font-black text-sm ${calcProfit(row) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eurDec(calcProfit(row))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}