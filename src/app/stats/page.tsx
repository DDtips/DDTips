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

  let chartSourceRows = settled;
  const currentYear = new Date().getFullYear();
  if (!isFilteredByDate) {
      chartSourceRows = settled.filter(r => new Date(r.datum).getFullYear() === currentYear);
  }

  const dailyMap = new Map<string, number>();
  chartSourceRows.forEach(r => {
      const dateKey = r.datum; 
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + calcProfit(r));
  });

  const sortedDates = Array.from(dailyMap.keys()).sort();
  let runningProfit = 0;
  const chartData = sortedDates.map(date => {
      runningProfit += dailyMap.get(date) || 0;
      return {
          date: new Date(date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' }),
          rawDate: date,
          profit: runningProfit
      };
  });

  if (!isFilteredByDate && chartData.length > 0 && chartData[0].rawDate > `${currentYear}-01-01`) {
      chartData.unshift({ date: "1. Jan", rawDate: `${currentYear}-01-01`, profit: 0 });
  } else if (!isFilteredByDate && chartData.length === 0) {
      chartData.push({ date: "1. Jan", rawDate: `${currentYear}-01-01`, profit: 0 });
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];
  const monthlyRows = isFilteredByDate ? settled : rows.filter(r => new Date(r.datum).getFullYear() === currentYear && r.wl !== "OPEN" && r.wl !== "VOID");
  const monthlyData = monthNames.map((name, index) => {
      const monthProfit = monthlyRows.filter(r => new Date(r.datum).getMonth() === index).reduce((acc, r) => acc + calcProfit(r), 0);
      return { month: name, profit: monthProfit };
  });

  return { profit, n, wins, losses, roi, winRate, growth, avgOdds, chartData, monthlyData, settled, preProfit, liveProfit };
}

function getBreakdown(rows: Bet[], key: 'tipster' | 'sport' | 'cas_stave') {
  const groups = new Set(rows.map(r => r[key]).filter(Boolean));
  const data = Array.from(groups).map(item => {
    const itemRows = rows.filter(r => r[key] === item);
    const bettingProfit = itemRows.filter(r => getMode(r) === "BET").reduce((acc, r) => acc + calcProfit(r), 0);
    const tradingProfit = itemRows.filter(r => getMode(r) === "TRADING").reduce((acc, r) => acc + calcProfit(r), 0);
    const totalProfit = bettingProfit + tradingProfit;
    return { name: item, bettingProfit, tradingProfit, totalProfit, count: itemRows.length };
  });
  return data.sort((a, b) => b.totalProfit - a.totalProfit);
}

// --- KOMPONENTE ---

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const isPositive = value >= 0;
    return (
      <div className="glass-tooltip p-3 min-w-[120px]">
        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-2 border-b border-white/10 pb-1">{label}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-300 font-medium">Profit:</span>
          <span className={`text-sm font-mono font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{value > 0 ? "+" : ""}{eurDec(value)}</span>
        </div>
      </div>
    );
  }
  return null;
};

// KOMPAKTNA KARTICA (KPI) - Z GLASS EFEKTOM
function CompactStatCard({ label, value, subValue, icon: Icon, color = "text-white" }: any) {
  const glowColor = color.includes("emerald") ? "rgba(16, 185, 129, 0.15)" : color.includes("rose") ? "rgba(244, 63, 94, 0.15)" : "rgba(255, 255, 255, 0.05)";
  
  return (
    <div 
      className="glass-card p-4 flex items-center justify-between group"
      style={{ "--glow-color": glowColor } as React.CSSProperties}
    >
      <div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <h4 className={`text-2xl font-mono font-bold tracking-tight ${color}`}>{value}</h4>
          {subValue && <span className="text-xs font-bold text-zinc-600">{subValue}</span>}
        </div>
      </div>
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 group-hover:text-white transition-colors">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

// RAZDELITEV KARTICA (Betting vs Trading + Prematch vs Live) - Z GLASS EFEKTOM
function SplitCard({ bettingStats, tradingStats, prematchStats, liveStats }: { bettingStats: any, tradingStats: any, prematchStats: any, liveStats: any }) {
  const modeTotal = Math.abs(bettingStats.profit) + Math.abs(tradingStats.profit);
  const betPerc = modeTotal === 0 ? 50 : (Math.abs(bettingStats.profit) / modeTotal) * 100;
  const tradePerc = 100 - betPerc;

  const timeTotal = Math.abs(prematchStats.profit) + Math.abs(liveStats.profit);
  const prematchPerc = timeTotal === 0 ? 50 : (Math.abs(prematchStats.profit) / timeTotal) * 100;
  const livePerc = 100 - prematchPerc;

  return (
    <div className="glass-card p-6 h-full flex flex-col" style={{ "--glow-color": "rgba(139, 92, 246, 0.1)" } as React.CSSProperties}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-violet-500" /> Struktura Profita
        </h3>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-4">
        {/* SEKCIJA: Betting vs Trading */}
        <div className="pb-4 border-b border-white/5">
          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-3">Po Načinu</p>
          
          {/* Betting Row */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold text-sky-500 uppercase tracking-widest flex items-center gap-1.5"><Target className="w-3 h-3"/> Betting</span>
              <span className={`font-mono text-sm font-bold ${bettingStats.profit >=0 ? "text-white" : "text-rose-400"}`}>{eur(bettingStats.profit)}</span>
            </div>
            <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500/50 rounded-full transition-all duration-500" style={{ width: `${betPerc}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-zinc-600 font-mono">
              <span>ROI: {bettingStats.roi.toFixed(1)}%</span>
              <span>{bettingStats.n} Stav</span>
            </div>
          </div>

          {/* Trading Row */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest flex items-center gap-1.5"><Activity className="w-3 h-3"/> Trading</span>
              <span className={`font-mono text-sm font-bold ${tradingStats.profit >=0 ? "text-white" : "text-rose-400"}`}>{eur(tradingStats.profit)}</span>
            </div>
            <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500/50 rounded-full transition-all duration-500" style={{ width: `${tradePerc}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-zinc-600 font-mono">
              <span>ROI: {tradingStats.roi.toFixed(1)}%</span>
              <span>{tradingStats.n} Stav</span>
            </div>
          </div>
        </div>

        {/* SEKCIJA: Prematch vs Live */}
        <div>
          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-3">Po Času</p>
          
          {/* Prematch Row */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3 h-3"/> Prematch</span>
              <span className={`font-mono text-sm font-bold ${prematchStats.profit >=0 ? "text-white" : "text-rose-400"}`}>{eur(prematchStats.profit)}</span>
            </div>
            <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500/50 rounded-full transition-all duration-500" style={{ width: `${prematchPerc}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-zinc-600 font-mono">
              <span>ROI: {prematchStats.roi.toFixed(1)}%</span>
              <span>{prematchStats.n} Stav</span>
            </div>
          </div>

          {/* Live Row */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1.5"><Layers className="w-3 h-3"/> Live</span>
              <span className={`font-mono text-sm font-bold ${liveStats.profit >=0 ? "text-white" : "text-rose-400"}`}>{eur(liveStats.profit)}</span>
            </div>
            <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500/50 rounded-full transition-all duration-500" style={{ width: `${livePerc}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-zinc-600 font-mono">
              <span>ROI: {liveStats.roi.toFixed(1)}%</span>
              <span>{liveStats.n} Stav</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- INPUT FIELD Z GLASS STILOM ---
function InputField({ label, value, onChange, type = "text", icon, placeholder }: any) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleContainerClick = () => {
        if (type === 'date' && inputRef.current) {
            try {
                inputRef.current.showPicker();
            } catch (e) {
                inputRef.current.focus();
            }
        }
    };

    return (
      <div className="space-y-1.5 pointer-events-auto group">
        <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
          {icon} {label}
        </label>
        <div className="relative" onClick={handleContainerClick}>
            <input
            ref={inputRef}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`glass-input w-full px-3 py-2.5 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700 text-center font-medium cursor-pointer ${type === 'date' ? '[color-scheme:dark]' : ''}`}
            />
            <style jsx>{`
                input[type="date"]::-webkit-calendar-picker-indicator {
                    cursor: pointer;
                    filter: invert(1) opacity(0.5);
                    transition: opacity 0.2s;
                }
                input[type="date"]::-webkit-calendar-picker-indicator:hover {
                    opacity: 1;
                }
            `}</style>
        </div>
      </div>
    );
  }
  
  function SelectField({ label, value, onChange, options, icon }: any) {
    return (
      <div className="space-y-1.5 pointer-events-auto group">
        <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
          {icon} {label}
        </label>
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="glass-input w-full px-3 py-2.5 appearance-none rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer text-center font-medium"
          >
            {options.map((opt: string) => <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
        </div>
      </div>
    );
  }

  function MultiSelectField({ label, options, selected, onChange, icon }: { label: string, options: string[], selected: string[], onChange: (val: string[]) => void, icon?: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
  
    const toggleOption = (opt: string) => {
      if (selected.includes(opt)) {
        onChange(selected.filter(s => s !== opt));
      } else {
        onChange([...selected, opt]);
      }
    };
  
    return (
      <div className="space-y-1.5 relative pointer-events-auto group" ref={dropdownRef}>
        <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
          {icon} {label}
        </label>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="glass-input w-full px-3 py-2.5 rounded-lg text-white text-xs flex items-center justify-between hover:border-emerald-500/50 transition-all"
        >
          <span className="truncate font-medium">
            {selected.length === 0 ? "Vsi" : selected.length === 1 ? selected[0] : `${selected.length} izbrano`}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
  
        {isOpen && (
          <div className="absolute top-full left-0 w-full mt-2 glass-dropdown rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
             {options.map(opt => {
               const isSelected = selected.includes(opt);
               return (
                 <div 
                   key={opt} 
                   onClick={() => toggleOption(opt)}
                   className={`px-3 py-2.5 text-xs flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border-l-2 ${isSelected ? "border-emerald-500 bg-emerald-500/5 text-emerald-400 font-bold" : "border-transparent text-zinc-400"}`}
                 >
                   <span>{opt}</span>
                   {isSelected && <Check className="w-3.5 h-3.5" />}
                 </div>
               )
             })}
          </div>
        )}
      </div>
    );
  }

// --- GLAVNA STRAN ---
export default function StatsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
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
    const checkAccess = async () => {
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

      const isDejan = user.email === "skolnik.dejan40@gmail.com";
      if (!isDejan && (profileError || !profile || !profile.is_approved)) {
        router.replace("/pending");
        return;
      }

      await loadRows();
    };

    checkAccess();
  }, [router]);

  async function loadRows() {
    setLoading(true);
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: true });
    setLoading(false);
    if (!error) setRows((data ?? []) as Bet[]);
  }

  const handleRefresh = async () => {
    setSelectedSports([]); setSelectedTipsters([]); setStavnica("ALL"); setCas("ALL"); setFromDate(""); setToDate(""); setMinKvota(""); setMaxKvota(""); setFiltersOpen(false); await loadRows();
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
  const prematchRows = useMemo(() => filteredRows.filter(r => r.cas_stave === "PREMATCH"), [filteredRows]);
  const liveRows = useMemo(() => filteredRows.filter(r => r.cas_stave === "LIVE"), [filteredRows]);

  const totalStats = useMemo(() => buildStats(rows, filteredRows, isFilteredByDate), [rows, filteredRows, isFilteredByDate]);
  const bettingStats = useMemo(() => buildStats(rows, bettingRows, isFilteredByDate), [rows, bettingRows, isFilteredByDate]);
  const tradingStats = useMemo(() => buildStats(rows, tradingRows, isFilteredByDate), [rows, tradingRows, isFilteredByDate]);
  const prematchStats = useMemo(() => buildStats(rows, prematchRows, isFilteredByDate), [rows, prematchRows, isFilteredByDate]);
  const liveStats = useMemo(() => buildStats(rows, liveRows, isFilteredByDate), [rows, liveRows, isFilteredByDate]);

  const tipsterBreakdown = useMemo(() => getBreakdown(filteredRows, 'tipster'), [filteredRows]);
  const sportBreakdown = useMemo(() => getBreakdown(filteredRows, 'sport'), [filteredRows]);
  const casBreakdown = useMemo(() => getBreakdown(filteredRows, 'cas_stave'), [filteredRows]);

  const tipsterTotals = useMemo(() => tipsterBreakdown.reduce((acc, curr) => ({ bet: acc.bet + curr.bettingProfit, trade: acc.trade + curr.tradingProfit, total: acc.total + curr.totalProfit }), { bet: 0, trade: 0, total: 0 }), [tipsterBreakdown]);
  const sportTotals = useMemo(() => sportBreakdown.reduce((acc, curr) => ({ bet: acc.bet + curr.bettingProfit, trade: acc.trade + curr.tradingProfit, total: acc.total + curr.totalProfit }), { bet: 0, trade: 0, total: 0 }), [sportBreakdown]);
  const casTotals = useMemo(() => casBreakdown.reduce((acc, curr) => ({ bet: acc.bet + curr.bettingProfit, trade: acc.trade + curr.tradingProfit, total: acc.total + curr.totalProfit }), { bet: 0, trade: 0, total: 0 }), [casBreakdown]);

  if (loading && rows.length === 0) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4 text-center p-6">
      <Loader2 className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">Preverjanje dostopa...</p>
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

        /* Glass Input */
        .glass-input {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .glass-input:focus {
          border-color: rgba(16, 185, 129, 0.5);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.15);
        }

        /* Glass Dropdown */
        .glass-dropdown {
          background: linear-gradient(
            135deg,
            rgba(9, 9, 11, 0.95) 0%,
            rgba(9, 9, 11, 0.9) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
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
          border-radius: 12px;
        }

        /* Glass Chart */
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
        }

        /* Glass Table */
        .glass-table {
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
        }

        /* Glass Form */
        .glass-form {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.04) 0%,
            rgba(255, 255, 255, 0.01) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        /* Glass Button */
        .glass-button {
          background: linear-gradient(
            135deg,
            rgba(16, 185, 129, 0.9) 0%,
            rgba(16, 185, 129, 0.7) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 
            0 15px 35px rgba(16, 185, 129, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .glass-button:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 20px 40px rgba(16, 185, 129, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.2) inset;
        }
      `}</style>

      <div className="relative max-w-[1800px] mx-auto px-6 md:px-10 pb-12 z-10">
        
        {/* HEADER & FILTER TOGGLE */}
        <div className="pt-48 pb-8 flex justify-between items-center relative z-[60]">
           <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-300">Statistika</h2>
           </div>
           
           <div className="flex gap-3">
            <button 
              onClick={() => setFiltersOpen(!filtersOpen)} 
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all cursor-pointer shadow-lg active:scale-95 backdrop-blur-md ${
                filtersOpen 
                  ? 'glass-card text-white font-bold' 
                  : 'glass-button text-black font-black'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">{filtersOpen ? "Zapri Filtre" : "Filtri"}</span>
              {hasActiveFilters && !filtersOpen && <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>}
            </button>
            <button 
              onClick={handleRefresh} 
              className="glass-card p-3 text-zinc-400 hover:text-emerald-400 transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-500" : ""}`} />
            </button>
          </div>
        </div>

        {/* FILTERS PANEL */}
        <div className={`transition-all duration-500 ease-in-out relative z-50 ${filtersOpen ? 'opacity-100 max-h-[600px] mb-12 translate-y-0' : 'max-h-0 opacity-0 mb-0 -translate-y-4 overflow-hidden pointer-events-none'}`}>
          <div className="glass-card p-1">
            <div className="glass-form rounded-[18px] p-8">
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
                <button onClick={() => setFiltersOpen(false)} className="glass-button px-8 py-2.5 text-black text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer active:scale-95">Uporabi</button>
                </div>
            </div>
          </div>
        </div>

        {/* KPI GRID */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <CompactStatCard 
                label="Total Profit" 
                value={eur(totalStats.profit)} 
                color={totalStats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}
                icon={Trophy}
            />
            <CompactStatCard 
                label="ROI" 
                value={`${totalStats.roi.toFixed(1)}%`} 
                color={totalStats.roi >= 0 ? "text-emerald-400" : "text-rose-400"}
                icon={TrendingUp}
            />
            <CompactStatCard 
                label="Win Rate" 
                value={`${totalStats.winRate.toFixed(0)}%`} 
                subValue={`${totalStats.wins}W - ${totalStats.losses}L`}
                icon={Activity}
            />
            <CompactStatCard 
                label="Število Stav" 
                value={totalStats.n} 
                subValue="Vseh skupaj"
                icon={Hash}
            />
        </section>

        {/* GLAVNI GRAF + SIDEBAR */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            
            {/* GLAVNI GRAF */}
            <div className="lg:col-span-2 glass-chart p-6 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em] flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" /> Tekoči Profit
                    </h3>
                </div>
                <div className="flex-1 min-h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={totalStats.chartData}>
                        <defs>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} dy={10} />
                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val > 1000 ? val/1000 + 'k' : val}`} dx={-10} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                        <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* SIDEBAR: Betting vs Trading + Prematch vs Live */}
            <div className="lg:col-span-1">
                <SplitCard bettingStats={bettingStats} tradingStats={tradingStats} prematchStats={prematchStats} liveStats={liveStats} />
            </div>
        </section>

        {/* SEKUNDARNI GRAFI */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
             {/* TIPSTER BREAKDOWN */}
             <div className="glass-chart p-6 flex flex-col h-[400px]">
                <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-300">Tipster Profit</h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <div className="grid grid-cols-3 text-[9px] font-bold text-zinc-500 uppercase px-3 mb-2 sticky top-0 bg-black/50 backdrop-blur-sm z-10 py-2 rounded-lg border-b border-white/5">
                      <span>Ime</span>
                      <span className="text-right">Št. Stav</span>
                      <span className="text-right text-white">Profit</span>
                    </div>
                    {tipsterBreakdown.map(t => (
                        <div key={t.name} className="grid grid-cols-3 text-xs px-3 py-2.5 hover:bg-white/5 rounded-lg transition-all border border-transparent hover:border-white/5 group">
                          <span className="font-bold text-zinc-300">{t.name}</span>
                          <span className="text-right text-zinc-500 font-mono">{t.count}</span>
                          <span className={`text-right font-mono font-bold ${t.totalProfit>=0?"text-emerald-400":"text-rose-400"}`}>{eurDec(t.totalProfit)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* MESEČNI GRAF */}
            <div className="glass-chart p-6 h-[400px] flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-300">Mesečni Pregled</h3>
                </div>
                <div className="flex-1 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={totalStats.monthlyData}>
                         <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                         <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 4 }} />
                         <Bar dataKey="profit" radius={[4, 4, 4, 4]}>
                            {totalStats.monthlyData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#10b981" : "#f43f5e"} />))}
                         </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
        </section>

        {/* TABELA */}
        <section className="glass-table overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-300">Zadnje Aktivnosti</h2>
            </div>
            <div className="text-[10px] font-bold text-zinc-500 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">Zadnjih 20 stav</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-separate border-spacing-0">
              <thead>
                <tr className="bg-black/50 backdrop-blur-sm">
                  <th className="p-4 text-center text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">Datum</th>
                  <th className="p-4 text-center text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">Mode</th>
                  <th className="p-4 text-center text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">Status</th>
                  <th className="p-4 text-center text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-white/5 w-[200px]">Dogodek</th>
                  <th className="p-4 text-center text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">Stavnica</th>
                  <th className="p-4 text-center text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">Tipster</th>
                  <th className="p-4 text-center text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">Kvota</th>
                  <th className="p-4 text-center text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {totalStats.settled.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center opacity-40">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3 border border-white/10">
                          <Inbox className="w-6 h-6 text-zinc-500" />
                        </div>
                        <p className="text-zinc-500 text-xs uppercase tracking-wider">Ni podatkov za prikaz</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  totalStats.settled.slice().reverse().slice(0, 20).map((row) => {
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
                    <tr key={row.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-4 text-zinc-400 text-center font-mono border-b border-white/5">{new Date(row.datum).toLocaleDateString("sl-SI")}</td>
                      <td className="p-4 text-center border-b border-white/5"><span className={`px-2 py-0.5 rounded text-xs font-bold border tracking-wider ${getMode(row) === 'TRADING' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}>{getMode(row)}</span></td>
                      <td className="p-4 text-center border-b border-white/5">{statusBadge}</td>
                      <td className="p-4 text-zinc-300 text-center font-medium group-hover:text-white transition-colors border-b border-white/5">{row.dogodek || "-"}</td>
                      <td className="p-4 text-center text-zinc-500 uppercase text-[9px] font-bold tracking-wider border-b border-white/5">{row.stavnica}</td>
                      <td className="p-4 text-center border-b border-white/5"><span className="px-2 py-1 rounded bg-white/5 text-zinc-400 border border-white/10 text-[10px] font-bold">{row.tipster}</span></td>
                      <td className="p-4 text-center text-zinc-300 font-mono font-bold border-b border-white/5">{displayKvota > 0 ? displayKvota.toFixed(2) : "-"}</td>
                      <td className={`p-4 text-center font-mono font-black text-sm border-b border-white/5 ${calcProfit(row) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eurDec(calcProfit(row))}</td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-12 pt-8 border-t border-white/5 text-center flex flex-col md:flex-row justify-between items-center text-zinc-500 text-xs gap-2">
          <p className="hover:text-zinc-300 transition-colors">© 2026 DDTips Analytics.</p>
          <p className="font-mono bg-white/5 px-3 py-1 rounded-full border border-white/10">Realtime Stats</p>
        </footer>
      </div>
    </main>
  );
}