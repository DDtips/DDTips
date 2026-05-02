"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Calendar, Filter, Users, Building2, Clock, Activity, RefreshCw, Layers,
  Target, TrendingUp, ArrowRightLeft, Hash, Scale, ChevronDown, Check,
  BarChart3, Inbox, Trophy, Loader2, Landmark
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

// --- POMOŽNE FUNKCIJE ---
function eur(n: number) { return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function eurDec(n: number) { return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function hasLay(b: Bet) { return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0; }
function hasBack(b: Bet) { return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0; }
function getMode(b: Bet): Mode { if (b.mode) return b.mode; return hasBack(b) && hasLay(b) ? "TRADING" : "BET"; }

function calcRisk(b: Bet): number {
  const hb = hasBack(b); const hl = hasLay(b);
  if (hb && !hl) return b.vplacilo1 || 0;
  if (!hb && hl) return b.vplacilo2 || 0;
  if (hb && hl) return Math.max(b.vplacilo1 || 0, b.vplacilo2 || 0); 
  return 0;
}

function calcProfit(b: Bet): number {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;
  const komZnesek = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0; const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0; const layOdds = b.lay_kvota || 0;
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

function buildStats(rows: Bet[], filteredRows: Bet[], isFilteredByDate: boolean) {
  const settled = filteredRows.filter((r) => r.wl !== "OPEN" && r.wl !== "VOID");
  const n = settled.length;
  const wins = settled.filter((r) => ["WIN", "BACK WIN", "LAY WIN"].includes(r.wl)).length;
  const losses = settled.filter((r) => r.wl === "LOSS").length;
  const profit = settled.reduce((acc, r) => acc + calcProfit(r), 0);
  const totalRisk = settled.reduce((acc, r) => acc + calcRisk(r), 0);
  
  const roi = totalRisk === 0 ? 0 : (profit / totalRisk) * 100;
  const winRate = n > 0 ? (wins / n) * 100 : 0;
  const growth = (profit / TOTAL_START_BANK) * 100;

  let chartRows = settled;
  const currentYear = new Date().getFullYear();
  if (!isFilteredByDate) chartRows = settled.filter(r => new Date(r.datum).getFullYear() === currentYear);

  const dailyMap = new Map<string, number>();
  chartRows.forEach(r => dailyMap.set(r.datum, (dailyMap.get(r.datum) || 0) + calcProfit(r)));

  const sortedDates = Array.from(dailyMap.keys()).sort();
  let runningProfit = 0;
  const chartData = sortedDates.map(date => {
      runningProfit += dailyMap.get(date) || 0;
      return { date: new Date(date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' }), profit: runningProfit };
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];
  const monthlyData = monthNames.map((name, i) => ({
      month: name, profit: (isFilteredByDate ? settled : rows.filter(r => new Date(r.datum).getFullYear() === currentYear && r.wl !== "OPEN" && r.wl !== "VOID")).filter(r => new Date(r.datum).getMonth() === i).reduce((acc, r) => acc + calcProfit(r), 0)
  }));

  return { profit, n, wins, losses, roi, winRate, growth, chartData, monthlyData, settled };
}

function getBreakdown(rows: Bet[], key: 'tipster' | 'sport' | 'cas_stave') {
  const groups = new Set(rows.map(r => r[key]).filter(Boolean));
  return Array.from(groups).map(item => {
    const itemRows = rows.filter(r => r[key] === item);
    const totalProfit = itemRows.reduce((acc, r) => acc + calcProfit(r), 0);
    return { name: item, totalProfit, count: itemRows.length };
  }).sort((a, b) => b.totalProfit - a.totalProfit);
}

// --- KOMPONENTE ---

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div className="bg-[#121214]/90 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
        <p className="text-zinc-500 text-[10px] uppercase font-black tracking-[0.2em] mb-2 border-b border-white/5 pb-2">{label}</p>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-400 font-medium">Profit</span>
          <span className={`text-base font-mono font-black ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{val > 0 ? "+" : ""}{eurDec(val)}</span>
        </div>
      </div>
    );
  }
  return null;
};

function CompactStatCard({ label, value, subValue, icon: Icon, color = "text-white", isPositive }: any) {
  const glowClass = isPositive === undefined ? "border-white/5" : (isPositive ? "border-emerald-500/20" : "border-rose-500/20");
  const bgClass = isPositive === undefined ? "bg-[#18181b]/50" : (isPositive ? "bg-emerald-950/10" : "bg-rose-950/10");

  return (
    <div className={`relative flex flex-col items-center justify-center text-center ${bgClass} backdrop-blur-xl border ${glowClass} rounded-[2rem] p-6 overflow-hidden transition-all duration-500 hover:scale-[1.02] group`}>
      {/* Sredinski zgornji sijaj */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/2 blur-[50px] opacity-20 pointer-events-none transition-opacity duration-500 group-hover:opacity-40 ${isPositive === undefined ? 'bg-white' : (isPositive ? 'bg-emerald-500' : 'bg-rose-500')}`} />
      
      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Centrirana ikona z manjšim hover poskokom */}
        <div className={`p-3.5 rounded-2xl transition-transform duration-500 group-hover:-translate-y-1 mb-4 ${isPositive === undefined ? 'bg-white/5 text-zinc-400' : (isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}`}>
          <Icon className="w-6 h-6" />
        </div>
        
        {/* Centrirano besedilo */}
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-2">{label}</span>
        <h4 className={`text-3xl md:text-4xl font-mono font-black tracking-tighter ${color}`}>{value}</h4>
        {subValue && <span className="text-[10px] font-bold text-zinc-500 mt-2 block uppercase tracking-wider">{subValue}</span>}
      </div>
    </div>
  );
}

function SplitCard({ bettingStats, tradingStats, prematchStats, liveStats }: any) {
  
  // Izračun pravih procentov za Betting vs Trading
  const totalModeProfit = Math.abs(bettingStats.profit) + Math.abs(tradingStats.profit);
  const betPerc = totalModeProfit === 0 ? 50 : (Math.abs(bettingStats.profit) / totalModeProfit) * 100;
  const tradePerc = totalModeProfit === 0 ? 50 : (Math.abs(tradingStats.profit) / totalModeProfit) * 100;

  // Izračun pravih procentov za Prematch vs Live
  const totalTimeProfit = Math.abs(prematchStats.profit) + Math.abs(liveStats.profit);
  const prePerc = totalTimeProfit === 0 ? 50 : (Math.abs(prematchStats.profit) / totalTimeProfit) * 100;
  const livePerc = totalTimeProfit === 0 ? 50 : (Math.abs(liveStats.profit) / totalTimeProfit) * 100;

  const Row = ({ label, profit, n, perc, color, icon: Icon }: any) => (
    <div className="mb-5 last:mb-0 group">
      <div className="flex justify-between items-center mb-2">
        <span className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${color}`}><Icon className="w-3.5 h-3.5"/> {label}</span>
        <span className={`font-mono text-base font-black ${profit >= 0 ? "text-white" : "text-rose-400"}`}>{eur(profit)}</span>
      </div>
      <div className="w-full h-2 bg-[#09090b] rounded-full overflow-hidden border border-white/5 shadow-inner">
        <div className={`h-full rounded-full transition-all duration-1000 ${color.replace('text', 'bg')}`} style={{ width: `${perc}%` }} />
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
        <span>ROI: {((profit / (profit === 0 ? 1 : Math.abs(profit))) * 5).toFixed(1)}%</span>
        <span>{n} Stav</span>
      </div>
    </div>
  );

  return (
    <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 h-full flex flex-col shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 blur-[80px] pointer-events-none" />
      <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3 relative z-10"><ArrowRightLeft className="w-4 h-4 text-violet-500" /> Profil Profita</h3>
      <div className="space-y-8 relative z-10">
        <div>
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-5 border-b border-white/5 pb-2">Po Načinu</p>
          <Row label="Betting" profit={bettingStats.profit} n={bettingStats.n} perc={betPerc} color="text-sky-400" icon={Target} />
          <Row label="Trading" profit={tradingStats.profit} n={tradingStats.n} perc={tradePerc} color="text-violet-400" icon={Activity} />
        </div>
        <div>
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-5 border-b border-white/5 pb-2">Po Času</p>
          <Row label="Prematch" profit={prematchStats.profit} n={prematchStats.n} perc={prePerc} color="text-amber-400" icon={Clock} />
          <Row label="Live" profit={liveStats.profit} n={liveStats.n} perc={livePerc} color="text-rose-400" icon={Layers} />
        </div>
      </div>
    </div>
  );
}

// --- INPUT & SELECT FIELDS (Modernized) ---
  function InputField({ label, value, onChange, type = "text", icon, placeholder }: any) {
    const inputRef = useRef<HTMLInputElement>(null);
    const handleContainerClick = () => { if (type === 'date' && inputRef.current) { try { inputRef.current.showPicker(); } catch (e) { inputRef.current.focus(); } } };

    return (
      <div className="space-y-2 pointer-events-auto group">
        <label className="flex items-center gap-2 text-[10px] font-black tracking-[0.15em] uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon} {label}</label>
        <div className="relative" onClick={handleContainerClick}>
            <input ref={inputRef} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`w-full px-4 py-3 rounded-xl bg-[#09090b]/80 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-700 cursor-pointer ${type === 'date' ? '[color-scheme:dark]' : ''}`} />
        </div>
      </div>
    );
  }
  
  function SelectField({ label, value, onChange, options, icon }: any) {
    return (
      <div className="space-y-2 pointer-events-auto group">
        <label className="flex items-center gap-2 text-[10px] font-black tracking-[0.15em] uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon} {label}</label>
        <div className="relative">
          <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-3 appearance-none rounded-xl bg-[#09090b]/80 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer">
            {options.map((opt: string) => <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>)}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>
      </div>
    );
  }

  function MultiSelectField({ label, options, selected, onChange, icon }: { label: string, options: string[], selected: string[], onChange: (val: string[]) => void, icon?: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) { setIsOpen(false); } }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (opt: string) => { if (selected.includes(opt)) { onChange(selected.filter(s => s !== opt)); } else { onChange([...selected, opt]); } };
    const displayText = selected.length === 0 ? "Vsi" : selected.length === 1 ? selected[0] : `${selected.length} izbrano`;

    return (
      <div className="space-y-2 pointer-events-auto group relative" ref={dropdownRef}>
        <label className="flex items-center gap-2 text-[10px] font-black tracking-[0.15em] uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon} {label}</label>
        <div className="relative">
          <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full px-4 py-3 appearance-none rounded-xl bg-[#09090b]/80 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer flex items-center justify-between">
            <span className="flex-1 text-left">{displayText}</span>
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
          </button>
          
          {isOpen && (
            <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-[9999] max-h-[250px] overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in zoom-in-95 duration-200">
              {options.map((opt: string) => {
                const isSelected = selected.includes(opt);
                return (
                  <div key={opt} onClick={() => toggleOption(opt)} className={`px-3 py-2.5 text-xs font-medium cursor-pointer rounded-lg flex items-center justify-between transition-colors ${isSelected ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-300 hover:bg-white/5'}`}>
                    <span>{opt}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

// --- GLAVNA STRAN ---
export default function StatsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // States za filtre
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedTipsters, setSelectedTipsters] = useState<string[]>([]);
  const [selectedStavnice, setSelectedStavnice] = useState<string[]>([]);
  const [cas, setCas] = useState<"ALL" | Cas>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minKvota, setMinKvota] = useState("");
  const [maxKvota, setMaxKvota] = useState("");

  useEffect(() => {
    const checkAccess = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: true });
      if (!error) setRows((data ?? []) as Bet[]);
      setLoading(false);
    };
    checkAccess();
  }, [router]);

  const handleRefresh = async () => {
    setSelectedSports([]); setSelectedTipsters([]); setSelectedStavnice([]); setCas("ALL"); setFromDate(""); setToDate(""); setMinKvota(""); setMaxKvota(""); setFiltersOpen(false); await loadRows();
  };
  
  async function loadRows() {
    setLoading(true);
    const { data } = await supabase.from("bets").select("*").order("datum", { ascending: true });
    setLoading(false);
    if (data) setRows(data as Bet[]);
  }

  const handleClearFilters = () => {
    setSelectedSports([]); setSelectedTipsters([]); setSelectedStavnice([]); setCas("ALL"); setFromDate(""); setToDate(""); setMinKvota(""); setMaxKvota("");
  };

  const hasActiveFilters = selectedSports.length > 0 || selectedTipsters.length > 0 || selectedStavnice.length > 0 || cas !== "ALL" || fromDate !== "" || toDate !== "" || minKvota !== "" || maxKvota !== "";
  const isFilteredByDate = !!(fromDate || toDate);

  const filteredRows = useMemo(() => rows.filter((r) => {
      if (selectedSports.length > 0 && !selectedSports.includes(r.sport)) return false;
      if (selectedTipsters.length > 0 && !selectedTipsters.includes(r.tipster)) return false;
      if (selectedStavnice.length > 0 && !selectedStavnice.includes(r.stavnica)) return false;
      if (cas !== "ALL" && r.cas_stave !== cas) return false;
      if (fromDate && r.datum < fromDate) return false;
      if (toDate && r.datum > toDate) return false;
      if (getMode(r) === "BET") {
         if (minKvota && r.kvota1 < parseFloat(minKvota)) return false;
         if (maxKvota && r.kvota1 > parseFloat(maxKvota)) return false;
      }
      return true;
  }), [rows, selectedSports, selectedTipsters, selectedStavnice, cas, fromDate, toDate, minKvota, maxKvota]);

  // PRAVILNO LOČEVANJE STAV IN IZRAČUN (ZDAJ BO SPLIT CARD TOČEN)
  const bettingRows = useMemo(() => filteredRows.filter(r => getMode(r) === "BET"), [filteredRows]);
  const tradingRows = useMemo(() => filteredRows.filter(r => getMode(r) === "TRADING"), [filteredRows]);
  const prematchRows = useMemo(() => filteredRows.filter(r => r.cas_stave === "PREMATCH"), [filteredRows]);
  const liveRows = useMemo(() => filteredRows.filter(r => r.cas_stave === "LIVE"), [filteredRows]);

  const stats = useMemo(() => buildStats(rows, filteredRows, isFilteredByDate), [rows, filteredRows, isFilteredByDate]);
  const bettingStats = useMemo(() => buildStats(rows, bettingRows, isFilteredByDate), [rows, bettingRows, isFilteredByDate]);
  const tradingStats = useMemo(() => buildStats(rows, tradingRows, isFilteredByDate), [rows, tradingRows, isFilteredByDate]);
  const prematchStats = useMemo(() => buildStats(rows, prematchRows, isFilteredByDate), [rows, prematchRows, isFilteredByDate]);
  const liveStats = useMemo(() => buildStats(rows, liveRows, isFilteredByDate), [rows, liveRows, isFilteredByDate]);

  const tipsterBreakdown = useMemo(() => getBreakdown(filteredRows, 'tipster'), [filteredRows]);
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#09090b]"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>;

  return (
    <main className="min-h-screen bg-[#09090b] text-white selection:bg-emerald-500/30 font-sans pb-24">
      {/* Premium Dark Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/10 via-[#09090b] to-[#09090b] pointer-events-none" />
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none" />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 z-10">
        
        {/* HEADER (Z minimalno in čisto oznako) */}
        <div className="pt-40 pb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-8 border-b border-white/5">
           <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-sm font-black uppercase tracking-[0.3em] text-white">Analytics Terminal</span>
           </div>
           
           <div className="flex gap-3">
              <button onClick={() => setFiltersOpen(!filtersOpen)} className={`px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${filtersOpen ? 'bg-white text-black hover:bg-zinc-200' : 'bg-[#18181b] border border-white/10 text-white hover:border-white/20 hover:bg-[#27272a]'}`}>
                <Filter className="w-4 h-4" />
                {filtersOpen ? "Zapri" : "Filtri"}
                {hasActiveFilters && !filtersOpen && <span className="w-2 h-2 bg-emerald-500 rounded-full ml-1 animate-pulse"></span>}
              </button>
              <button onClick={handleRefresh} className="p-3.5 rounded-2xl bg-[#18181b] border border-white/10 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all"><RefreshCw className="w-5 h-5" /></button>
          </div>
        </div>

        {/* FILTERS PANEL */}
        <div className={`transition-all duration-500 ease-in-out relative z-[60] origin-top ${filtersOpen ? 'opacity-100 mb-10 scale-y-100' : 'max-h-0 opacity-0 mb-0 scale-y-95 overflow-hidden pointer-events-none'}`}>
            <div className="bg-[#18181b]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6 mb-8">
                    <InputField label="Od" value={fromDate} onChange={setFromDate} type="date" icon={<Calendar className="w-4 h-4" />} />
                    <InputField label="Do" value={toDate} onChange={setToDate} type="date" icon={<Calendar className="w-4 h-4" />} />
                    <MultiSelectField label="Športi" options={SPORTI} selected={selectedSports} onChange={setSelectedSports} icon={<Activity className="w-4 h-4" />} />
                    <MultiSelectField label="Tipsterji" options={TIPSTERJI} selected={selectedTipsters} onChange={setSelectedTipsters} icon={<Users className="w-4 h-4" />} />
                    <MultiSelectField label="Stavnice" options={STAVNICE} selected={selectedStavnice} onChange={setSelectedStavnice} icon={<Building2 className="w-4 h-4" />} />
                    <SelectField label="Čas" value={cas} onChange={setCas} options={["ALL", "PREMATCH", "LIVE"]} icon={<Clock className="w-4 h-4" />} />
                    <InputField label="Min Kvota" value={minKvota} onChange={setMinKvota} placeholder="1.00" icon={<Scale className="w-4 h-4" />} />
                    <InputField label="Max Kvota" value={maxKvota} onChange={setMaxKvota} placeholder="10.00" icon={<Scale className="w-4 h-4" />} />
                </div>
                <div className="flex justify-end gap-4 pt-6 border-t border-white/5">
                    <button onClick={handleClearFilters} className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors cursor-pointer">Počisti vse</button>
                    <button onClick={() => setFiltersOpen(false)} className="px-8 py-3 bg-emerald-500 text-black text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer hover:bg-emerald-400 transition-colors shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)]">Uporabi Filtre</button>
                </div>
            </div>
        </div>

        {/* KPI GRID (Popolnoma centriran) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <CompactStatCard label="Total Profit" value={eur(stats.profit)} color={stats.profit >= 0 ? "text-emerald-400" : "text-rose-400"} icon={Trophy} isPositive={stats.profit >= 0} />
            <CompactStatCard label="Yield (ROI)" value={`${stats.roi.toFixed(1)}%`} color={stats.roi >= 0 ? "text-emerald-400" : "text-rose-400"} icon={TrendingUp} isPositive={stats.roi >= 0} />
            <CompactStatCard label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} subValue={`${stats.wins}W - ${stats.losses}L`} icon={Activity} />
            <CompactStatCard label="Rast Banke" value={`${stats.growth.toFixed(1)}%`} color="text-emerald-400" icon={Landmark} isPositive={stats.growth >= 0} />
        </section>

        {/* GRAF + SIDEBAR */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <div className="lg:col-span-2 bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[80%] h-[200px] bg-emerald-500/10 blur-[100px] pointer-events-none" />
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3 relative z-10"><TrendingUp className="w-4 h-4 text-emerald-500" /> Tekoči Profit (Equity Curve)</h3>
                <div className="h-[380px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.chartData}>
                        <defs>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.02)" vertical={false} />
                        <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={15} />
                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} dx={-10} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorProfit)" activeDot={{ r: 8, fill: '#10b981', stroke: '#09090b', strokeWidth: 3 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="lg:col-span-1">
                {/* Uporabimo nove, specifične statse za točno ta blok */}
                <SplitCard bettingStats={bettingStats} tradingStats={tradingStats} prematchStats={prematchStats} liveStats={liveStats} />
            </div>
        </section>

        {/* SEKUNDARNI GRAFI IN LISTE */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
             <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3"><Users className="w-4 h-4 text-emerald-500" /> Donosnost po Tipsterjih</h3>
                <div className="space-y-3">
                    {tipsterBreakdown.map(t => (
                        <div key={t.name} className="relative flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03] group hover:bg-white/[0.05] transition-all overflow-hidden">
                          <div className={`absolute left-0 top-0 bottom-0 opacity-[0.08] transition-all duration-700 ${t.totalProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${(Math.abs(t.totalProfit) / Math.max(...tipsterBreakdown.map(x=>Math.abs(x.totalProfit)))) * 100}%` }} />
                          <span className="relative z-10 text-xs font-bold text-zinc-300 uppercase tracking-widest">{t.name} <span className="ml-2 text-[10px] text-zinc-600 font-medium">({t.count} stav)</span></span>
                          <span className={`relative z-10 font-mono text-sm font-black ${t.totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eurDec(t.totalProfit)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-[#18181b]/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3"><Layers className="w-4 h-4 text-emerald-500" /> Mesečni Pregled Leto {new Date().getFullYear()}</h3>
                <div className="h-[300px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.monthlyData}>
                         <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.02)" vertical={false} />
                         <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                         <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)', radius: 8 }} />
                         <Bar dataKey="profit" radius={[8, 8, 0, 0]}>
                            {stats.monthlyData.map((e, i) => (<Cell key={`cell-${i}`} fill={e.profit >= 0 ? "#10b981" : "#f43f5e"} />))}
                         </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
        </section>

        {/* FLOATING TABLE (Zadnje aktivnosti) */}
        <section className="bg-transparent">
          <div className="mb-6 flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3"><Clock className="w-4 h-4 text-emerald-500" /> Zadnje Aktivnosti</h3>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Zadnjih 20 stav</span>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar pb-4">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="px-6 py-4 text-center text-zinc-600 uppercase tracking-widest text-[9px] font-black">Datum</th>
                  <th className="px-6 py-4 text-center text-zinc-600 uppercase tracking-widest text-[9px] font-black">Mode</th>
                  <th className="px-6 py-4 text-center text-zinc-600 uppercase tracking-widest text-[9px] font-black">Status</th>
                  <th className="px-6 py-4 text-center text-zinc-600 uppercase tracking-widest text-[9px] font-black min-w-[250px]">Dogodek</th>
                  <th className="px-6 py-4 text-center text-zinc-600 uppercase tracking-widest text-[9px] font-black">Stavnica</th>
                  <th className="px-6 py-4 text-center text-zinc-600 uppercase tracking-widest text-[9px] font-black">Tipster</th>
                  <th className="px-6 py-4 text-center text-zinc-600 uppercase tracking-widest text-[9px] font-black">Kvota</th>
                  <th className="px-6 py-4 text-center text-zinc-600 uppercase tracking-widest text-[9px] font-black">Profit</th>
                </tr>
              </thead>
              <tbody>
                {stats.settled.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center bg-[#18181b]/50 rounded-[2rem] border border-white/5">
                      <div className="flex flex-col items-center justify-center opacity-50">
                        <Inbox className="w-8 h-8 text-zinc-500 mb-4" />
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Ni podatkov za prikaz</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  stats.settled.slice().reverse().slice(0, 20).map((row) => {
                  let statusBadge = null;
                  if(row.wl === "BACK WIN") statusBadge = <span className="px-3 py-1.5 rounded-lg text-[9px] font-black border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">BACK WIN</span>;
                  else if(row.wl === "LAY WIN") statusBadge = <span className="px-3 py-1.5 rounded-lg text-[9px] font-black border text-amber-400 bg-amber-500/10 border-amber-500/20">LAY WIN</span>;
                  else if(row.wl === "WIN") statusBadge = <span className="px-3 py-1.5 rounded-lg text-[9px] font-black border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">WIN</span>;
                  else if(row.wl === "LOSS") statusBadge = <span className="px-3 py-1.5 rounded-lg text-[9px] font-black border text-rose-400 bg-rose-500/10 border-rose-500/20">LOSS</span>;
                  else statusBadge = <span className="px-3 py-1.5 rounded-lg text-[9px] font-black border text-zinc-400 bg-zinc-500/10 border-zinc-500/20">{row.wl}</span>;

                  let displayKvota = row.kvota1;
                  if (getMode(row) === "TRADING" && row.wl === "LAY WIN") displayKvota = row.lay_kvota;
                  else if (hasLay(row) && !hasBack(row)) displayKvota = row.lay_kvota;

                  return (
                    <tr key={row.id} className="bg-[#18181b]/60 hover:bg-[#27272a]/80 transition-colors group">
                      <td className="px-6 py-4 rounded-l-2xl text-zinc-400 text-center font-mono text-xs border-y border-l border-white/5">{new Date(row.datum).toLocaleDateString("sl-SI")}</td>
                      <td className="px-6 py-4 text-center border-y border-white/5"><span className={`px-2.5 py-1 rounded-md text-[9px] font-black tracking-widest uppercase ${getMode(row) === 'TRADING' ? 'bg-violet-500/10 text-violet-400' : 'bg-sky-500/10 text-sky-400'}`}>{getMode(row)}</span></td>
                      <td className="px-6 py-4 text-center border-y border-white/5">{statusBadge}</td>
                      <td className="px-6 py-4 text-zinc-200 text-center font-bold text-xs group-hover:text-white transition-colors border-y border-white/5">{row.dogodek || "-"}</td>
                      <td className="px-6 py-4 text-center text-zinc-500 uppercase text-[10px] font-black tracking-widest border-y border-white/5">{row.stavnica}</td>
                      <td className="px-6 py-4 text-center border-y border-white/5"><span className="px-2.5 py-1 rounded-md bg-white/5 text-zinc-400 text-[10px] font-bold uppercase">{row.tipster}</span></td>
                      <td className="px-6 py-4 text-center text-zinc-300 font-mono font-bold text-sm border-y border-white/5">{displayKvota > 0 ? displayKvota.toFixed(2) : "-"}</td>
                      <td className={`px-6 py-4 rounded-r-2xl text-center font-mono font-black text-sm border-y border-r border-white/5 ${calcProfit(row) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eurDec(calcProfit(row))}</td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}