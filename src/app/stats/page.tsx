"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Calendar, Filter, Users, Building2, Clock, Activity, RefreshCw, Layers,
  Target, TrendingUp, Percent, ArrowRightLeft, Hash, Scale, ChevronDown, Check,
  BarChart3, Inbox, Trophy, Loader2
} from "lucide-react";

// --- TIPOVI ---
type WL = "OPEN" | "WIN" | "LOSS" | "VOID" | "BACK WIN" | "LAY WIN";
type Cas = "PREMATCH" | "LIVE";
type Mode = "BET" | "TRADING";

type Bet = {
  id: string; datum: string; wl: WL; kvota1: number; vplacilo1: number; lay_kvota: number;
  vplacilo2: number; komisija: number; sport: string; cas_stave: Cas;
  tipster: string; stavnica: string; dogodek?: string; tip?: string; mode?: Mode | null;
};

// --- KONSTANTE ---
const BOOK_START: Record<string, number> = {
  SHARP: 2000, PINNACLE: 2000, BET365: 2000, WINAMAX: 1000, WWIN: 500, "E-STAVE": 500, "BET AT HOME": 1000,
};
const TOTAL_START_BANK = Object.values(BOOK_START).reduce((a, b) => a + b, 0);
const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"];
const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"];
const STAVNICE = ["SHARP", "PINNACLE", "BET365", "WINAMAX", "WWIN", "BET AT HOME", "E-STAVE"];

// --- POMOŽNE FUNKCIJE (Izračuni ostajajo enaki) ---
function eur(n: number) { return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function eurDec(n: number) { return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function hasLay(b: Bet) { return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0; }
function hasBack(b: Bet) { return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0; }
function getMode(b: Bet): Mode { if (b.mode) return b.mode; return hasBack(b) && hasLay(b) ? "TRADING" : "BET"; }

function calcRisk(b: Bet): number {
  const hb = hasBack(b); const hl = hasLay(b);
  const bs = b.vplacilo1 || 0; const ll = b.vplacilo2 || 0;
  if (hb && !hl) return bs; if (!hb && hl) return ll;
  if (hb && hl) return Math.max(bs, ll); return 0;
}

function calcProfit(b: Bet): number {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;
  const kom = Number(b.komisija ?? 0);
  const bs = b.vplacilo1 || 0; const bo = b.kvota1 || 0;
  const ll = b.vplacilo2 || 0; const lo = b.lay_kvota || 0;
  const ls = lo > 1 ? ll / (lo - 1) : 0;
  let bruto = 0;
  if (hasBack(b) && hasLay(b)) {
    const pB = (bs * (bo - 1)) - ll; const pL = ls - bs;
    if (b.wl === "BACK WIN") bruto = pB; else if (b.wl === "LAY WIN") bruto = pL;
    else if (b.wl === "WIN") bruto = Math.max(pB, pL); else if (b.wl === "LOSS") bruto = Math.min(pB, pL);
  } else if (!hasBack(b) && hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") bruto = ls; else bruto = -ll;
  } else if (hasBack(b) && !hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") bruto = bs * (bo - 1); else bruto = -bs;
  }
  return bruto > 0 ? bruto - kom : bruto;
}

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

  let chartSourceRows = settled;
  const currentYear = new Date().getFullYear();
  if (!isFilteredByDate) chartSourceRows = settled.filter(r => new Date(r.datum).getFullYear() === currentYear);

  const dailyMap = new Map<string, number>();
  chartSourceRows.forEach(r => dailyMap.set(r.datum, (dailyMap.get(r.datum) || 0) + calcProfit(r)));
  const sortedDates = Array.from(dailyMap.keys()).sort();
  let runningProfit = 0;
  const chartData = sortedDates.map(date => {
      runningProfit += dailyMap.get(date) || 0;
      return { date: new Date(date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' }), profit: runningProfit };
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];
  const monthlyData = monthNames.map((name, index) => {
      const monthProfit = (isFilteredByDate ? settled : rows.filter(r => new Date(r.datum).getFullYear() === currentYear && r.wl !== "OPEN" && r.wl !== "VOID"))
        .filter(r => new Date(r.datum).getMonth() === index).reduce((acc, r) => acc + calcProfit(r), 0);
      return { month: name, profit: monthProfit };
  });

  return { profit, n, wins, losses, roi, winRate, growth, chartData, monthlyData, settled };
}

function getBreakdown(rows: Bet[], key: 'tipster' | 'sport' | 'cas_stave') {
  const groups = new Set(rows.map(r => r[key]).filter(Boolean));
  return Array.from(groups).map(item => {
    const itemRows = rows.filter(r => r[key] === item);
    const totalProfit = itemRows.reduce((acc, r) => acc + calcProfit(r), 0);
    return { name: item as string, totalProfit, count: itemRows.length };
  }).sort((a, b) => b.totalProfit - a.totalProfit);
}

// --- KOMPONENTE UI ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div className="bg-[#09090b]/90 border border-zinc-800 p-3 rounded-xl shadow-2xl backdrop-blur-md min-w-[120px]">
        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-2 border-b border-white/5 pb-1">{label}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-300 font-medium">Profit:</span>
          <span className={`text-sm font-mono font-black ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{val > 0 ? "+" : ""}{eurDec(val)}</span>
        </div>
      </div>
    );
  }
  return null;
};

function CompactStatCard({ label, value, subValue, icon: Icon, color = "text-white" }: any) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between hover:bg-zinc-900/60 transition-all group">
      <div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <h4 className={`text-2xl font-mono font-bold tracking-tight ${color}`}>{value}</h4>
          {subValue && <span className="text-xs font-bold text-zinc-600">{subValue}</span>}
        </div>
      </div>
      <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-zinc-500 group-hover:text-white transition-colors">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

function SplitCard({ bettingStats, tradingStats }: { bettingStats: any, tradingStats: any }) {
  const total = Math.abs(bettingStats.profit) + Math.abs(tradingStats.profit);
  const betPerc = total === 0 ? 50 : (Math.abs(bettingStats.profit) / total) * 100;
  const tradePerc = 100 - betPerc;
  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-sm rounded-2xl p-6 h-full flex flex-col">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-6"><ArrowRightLeft className="w-4 h-4 text-violet-500" /> Struktura Profita</h3>
      <div className="flex-1 flex flex-col justify-center gap-6">
        <div>
          <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-sky-500 uppercase tracking-widest flex items-center gap-2"><Target className="w-3 h-3"/> Betting</span><span className="font-mono font-bold">{eur(bettingStats.profit)}</span></div>
          <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden"><div className="h-full bg-sky-500/50" style={{ width: `${betPerc}%` }} /></div>
          <div className="flex justify-between mt-1 text-[10px] text-zinc-600 font-mono"><span>ROI: {bettingStats.roi.toFixed(1)}%</span><span>{bettingStats.n} Stav</span></div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-violet-500 uppercase tracking-widest flex items-center gap-2"><Activity className="w-3 h-3"/> Trading</span><span className="font-mono font-bold">{eur(tradingStats.profit)}</span></div>
          <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden"><div className="h-full bg-violet-500/50" style={{ width: `${tradePerc}%` }} /></div>
          <div className="flex justify-between mt-1 text-[10px] text-zinc-600 font-mono"><span>ROI: {tradingStats.roi.toFixed(1)}%</span><span>{tradingStats.n} Stav</span></div>
        </div>
      </div>
    </div>
  );
}

// (Ostali inputi/selecti ostajajo enaki...)
function InputField({ label, value, onChange, type = "text", icon, placeholder }: any) {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
      <div className="space-y-1.5 group">
        <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon} {label}</label>
        <div className="relative" onClick={() => inputRef.current?.showPicker()}>
            <input ref={inputRef} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-center font-medium [color-scheme:dark] cursor-pointer" />
        </div>
      </div>
    );
}

function SelectField({ label, value, onChange, options, icon }: any) {
    return (
      <div className="space-y-1.5 group">
        <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon} {label}</label>
        <div className="relative">
          <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2.5 appearance-none bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500/50 cursor-pointer text-center font-medium shadow-sm">
            {options.map((opt: string) => <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
        </div>
      </div>
    );
}

function MultiSelectField({ label, options, selected, onChange, icon }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const toggleOption = (opt: string) => selected.includes(opt) ? onChange(selected.filter((s:any) => s !== opt)) : onChange([...selected, opt]);
    return (
      <div className="space-y-1.5 relative group">
        <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon} {label}</label>
        <button onClick={() => setIsOpen(!isOpen)} className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs flex items-center justify-between hover:border-emerald-500/50 transition-all">
          <span className="truncate">{selected.length === 0 ? "Vsi" : `${selected.length} izbrano`}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen && (
          <div className="absolute top-full left-0 w-full mt-2 bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto">
             {options.map((opt:string) => (
                 <div key={opt} onClick={() => toggleOption(opt)} className={`px-3 py-2.5 text-xs flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 ${selected.includes(opt) ? "text-emerald-400 font-bold bg-emerald-500/5" : "text-zinc-400"}`}>
                   <span>{opt}</span>{selected.includes(opt) && <Check className="w-3.5 h-3.5" />}
                 </div>
             ))}
          </div>
        )}
      </div>
    );
}

// --- GLAVNA STRAN ---
export default function StatsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true); // START WITH TRUE
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedTipsters, setSelectedTipsters] = useState<string[]>([]);
  const [stavnica, setStavnica] = useState("ALL");
  const [cas, setCas] = useState<"ALL" | Cas>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minKvota, setMinKvota] = useState("");
  const [maxKvota, setMaxKvota] = useState("");

  useEffect(() => {
    const checkAccessAndLoad = async () => {
        setLoading(true);
        // 1. Check Auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/login"); return; }

        // 2. Check Profile Approval
        const { data: profile } = await supabase.from('profiles').select('is_approved').eq('id', user.id).single();
        if (!profile || !profile.is_approved) {
            router.replace("/pending");
            return;
        }

        // 3. Load Data
        await loadRows();
        setLoading(false);
    };
    checkAccessAndLoad();
  }, [router]);

  async function loadRows() {
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: true });
    if (!error) setRows((data ?? []) as Bet[]);
  }

  const handleRefresh = async () => { await loadRows(); };

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

  const isFilteredByDate = fromDate !== "" || toDate !== "";
  const totalStats = useMemo(() => buildStats(rows, filteredRows, isFilteredByDate), [rows, filteredRows, isFilteredByDate]);
  const bettingStats = useMemo(() => buildStats(rows, filteredRows.filter(r => getMode(r) === "BET"), isFilteredByDate), [rows, filteredRows, isFilteredByDate]);
  const tradingStats = useMemo(() => buildStats(rows, filteredRows.filter(r => getMode(r) === "TRADING"), isFilteredByDate), [rows, filteredRows, isFilteredByDate]);
  
  const tipsterBreakdown = useMemo(() => getBreakdown(filteredRows, 'tipster'), [filteredRows]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4">
      <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">Preverjanje dostopa...</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30 font-sans">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />
      
      <div className="relative max-w-[1800px] mx-auto px-6 md:px-10 pb-12 z-10">
        
        {/* HEADER */}
        <div className="pt-48 pb-8 flex justify-between items-center">
           <div className="flex items-center gap-3"><BarChart3 className="w-5 h-5 text-emerald-500" /><h2 className="text-sm font-bold tracking-widest uppercase text-zinc-300">Statistika</h2></div>
           <div className="flex gap-3">
            <button onClick={() => setFiltersOpen(!filtersOpen)} className={`px-6 py-3 rounded-2xl border transition-all flex items-center gap-2 ${filtersOpen ? 'bg-zinc-800 text-white' : 'bg-emerald-500 text-black font-black'}`}>
              <Filter className="w-4 h-4" /><span className="text-xs uppercase">Filtri</span>
            </button>
            <button onClick={handleRefresh} className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:text-emerald-400 transition-all"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>

        {/* FILTERS PANEL */}
        {filtersOpen && (
            <div className="mb-12 rounded-[2rem] bg-zinc-900/50 border border-zinc-800 p-8 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-5">
                    <InputField label="Od" value={fromDate} onChange={setFromDate} type="date" icon={<Calendar className="w-3.5 h-3.5" />} />
                    <InputField label="Do" value={toDate} onChange={setToDate} type="date" icon={<Calendar className="w-3.5 h-3.5" />} />
                    <MultiSelectField label="Športi" options={SPORTI} selected={selectedSports} onChange={setSelectedSports} icon={<Activity className="w-3.5 h-3.5" />} />
                    <MultiSelectField label="Tipsterji" options={TIPSTERJI} selected={selectedTipsters} onChange={setSelectedTipsters} icon={<Users className="w-3.5 h-3.5" />} />
                    <SelectField label="Stavnica" value={stavnica} onChange={setStavnica} options={["ALL", ...STAVNICE]} icon={<Building2 className="w-3.5 h-3.5" />} />
                    <SelectField label="Čas" value={cas} onChange={setCas} options={["ALL", "PREMATCH", "LIVE"]} icon={<Clock className="w-3.5 h-3.5" />} />
                    <InputField label="Min Kvota" value={minKvota} onChange={setMinKvota} placeholder="1.00" icon={<Scale className="w-3.5 h-3.5" />} />
                    <InputField label="Max Kvota" value={maxKvota} onChange={setMaxKvota} placeholder="10.00" icon={<Scale className="w-3.5 h-3.5" />} />
                </div>
            </div>
        )}

        {/* KPI GRID */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <CompactStatCard label="Total Profit" value={eur(totalStats.profit)} color={totalStats.profit >= 0 ? "text-emerald-400" : "text-rose-400"} icon={Trophy} />
            <CompactStatCard label="ROI" value={`${totalStats.roi.toFixed(1)}%`} color={totalStats.roi >= 0 ? "text-emerald-400" : "text-rose-400"} icon={TrendingUp} />
            <CompactStatCard label="Win Rate" value={`${totalStats.winRate.toFixed(0)}%`} subValue={`${totalStats.wins}W - ${totalStats.losses}L`} icon={Activity} />
            <CompactStatCard label="Število Stav" value={totalStats.n} subValue="Vseh skupaj" icon={Hash} />
        </section>

        {/* TEKOČI PROFIT + STRUKTURA */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <div className="lg:col-span-2 rounded-[2rem] bg-zinc-900/40 border border-zinc-800 p-6 shadow-lg min-h-[400px]">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Tekoči Profit</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={totalStats.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                            <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} dx={-10} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fill="rgba(16, 185, 129, 0.1)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="lg:col-span-1"><SplitCard bettingStats={bettingStats} tradingStats={tradingStats} /></div>
        </section>

        {/* TIPSTER BREAKDOWN */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
             <div className="rounded-[2rem] bg-zinc-900/40 border border-zinc-800 p-6 shadow-lg">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300 mb-6 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400" /> Tipster Profit</h3>
                <div className="space-y-2">
                    {tipsterBreakdown.map(t => (
                        <div key={t.name} className="flex justify-between items-center p-3 rounded-xl bg-black/20 border border-white/5">
                            <span className="font-bold text-zinc-300">{t.name}</span>
                            <div className="flex gap-4">
                                <span className="text-zinc-500 font-mono text-[10px] uppercase">{t.count} Stav</span>
                                <span className={`font-mono font-bold ${t.totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eurDec(t.totalProfit)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="rounded-[2rem] bg-zinc-900/40 border border-zinc-800 p-6 shadow-lg min-h-[300px]">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300 mb-6 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-500" /> Mesečni Pregled</h3>
                <div className="h-[250px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={totalStats.monthlyData}>
                         <XAxis dataKey="month" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                         <Tooltip content={<CustomTooltip />} />
                         <Bar dataKey="profit" radius={[4, 4, 4, 4]}>
                            {totalStats.monthlyData.map((e, i) => (<Cell key={i} fill={e.profit >= 0 ? "#10b981" : "#f43f5e"} />))}
                         </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
        </section>

        <footer className="mt-12 pt-8 border-t border-zinc-900 text-center text-zinc-600 text-[10px] uppercase tracking-widest">© 2024 DDTips Analytics</footer>
      </div>
    </main>
  );
}