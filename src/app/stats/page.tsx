"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Calendar, Filter, Users, Building2, Clock, Activity, RefreshCw, Layers,
  Target, TrendingUp, Percent, ArrowRightLeft, Hash, Scale, ChevronDown, Check
} from "lucide-react";

// --- TIPOVI ---
type WL = "OPEN" | "WIN" | "LOSS" | "VOID";
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
  const layStake = b.vplacilo2 || 0;
  const layOdds = b.lay_kvota || 0;
  const layLiability = (layOdds - 1) * layStake;
  if (hasBackBet && !hasLayBet) return backStake;
  if (!hasBackBet && hasLayBet) return layLiability;
  if (hasBackBet && hasLayBet) return layLiability; 
  return 0;
}

function calcProfit(b: Bet): number {
  const kom = b.komisija || 0;
  if (b.wl !== "WIN" && b.wl !== "LOSS") return 0;
  const backStake = b.vplacilo1 || 0;
  const backOdds = b.kvota1 || 0;
  const layStake = b.vplacilo2 || 0;
  const layOdds = b.lay_kvota || 0;
  const layLiability = (layOdds - 1) * layStake;
  const hasBackBet = hasBack(b);
  const hasLayBet = hasLay(b);

  if (!hasBackBet && hasLayBet) return (b.wl === "WIN" ? layStake : -layLiability) - kom;
  if (hasBackBet && !hasLayBet) return (b.wl === "WIN" ? backStake * (backOdds - 1) : -backStake) - kom;
  if (hasBackBet && hasLayBet) return (b.wl === "WIN" ? backStake * (backOdds - 1) - layLiability : -backStake + layStake) - kom;
  return 0;
}

function buildStats(rows: Bet[]) {
  const settled = rows.filter((r) => r.wl === "WIN" || r.wl === "LOSS");
  const n = settled.length;
  const wins = settled.filter((r) => r.wl === "WIN").length;
  const losses = settled.filter((r) => r.wl === "LOSS").length;
  const profit = settled.reduce((acc, r) => acc + calcProfit(r), 0);
  const totalRisk = settled.reduce((acc, r) => acc + calcRisk(r), 0);
  const roi = totalRisk === 0 ? 0 : (profit / totalRisk) * 100;
  const winRate = n > 0 ? (wins / n) * 100 : 0;
  const growth = (profit / TOTAL_START_BANK) * 100;
  const avgOdds = n > 0 ? settled.reduce((acc, r) => acc + (r.kvota1 || 0), 0) / n : 0;

  const preProfit = settled.filter(r => r.cas_stave === "PREMATCH").reduce((acc, r) => acc + calcProfit(r), 0);
  const liveProfit = settled.filter(r => r.cas_stave === "LIVE").reduce((acc, r) => acc + calcProfit(r), 0);

  let runningProfit = 0;
  const chartData = settled.sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime()).map((b) => {
    runningProfit += calcProfit(b);
    return { date: new Date(b.datum).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' }), profit: runningProfit };
  });

  return { profit, n, wins, losses, roi, winRate, growth, avgOdds, chartData, settled, preProfit, liveProfit };
}

// Generična funkcija za razčlenitev (Tipster, Šport, Čas)
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

// --- KOMPONENTE ---

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
    <div className="space-y-1 relative pointer-events-auto" ref={dropdownRef}>
      <label className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase text-zinc-500">
        {icon} {label}
      </label>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2 py-2 bg-zinc-950/50 border border-zinc-800 rounded-lg text-zinc-200 text-xs flex items-center justify-between hover:border-zinc-700 transition-colors"
      >
        <span className="truncate">
          {selected.length === 0 ? "VSI" : selected.length === 1 ? selected[0] : `${selected.length} izbrano`}
        </span>
        <ChevronDown className="w-3 h-3 text-zinc-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-[#09090b] border border-zinc-800 rounded-lg shadow-xl z-[100] max-h-60 overflow-y-auto">
           {options.map(opt => {
             const isSelected = selected.includes(opt);
             return (
               <div 
                 key={opt} 
                 onClick={() => toggleOption(opt)}
                 className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-colors ${isSelected ? "text-emerald-400 font-bold" : "text-zinc-400"}`}
               >
                 <span>{opt}</span>
                 {isSelected && <Check className="w-3 h-3" />}
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
    <div className="flex flex-col items-center justify-center p-2 text-center">
      <div className="flex items-center gap-1 mb-2 text-zinc-500 justify-center">
        {icon}
        <span className="text-[9px] font-bold tracking-widest uppercase">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 justify-center flex-wrap">
        <span className={`text-3xl md:text-4xl font-black ${color}`}>{value}</span>
        {inlineSub && <span className="text-lg font-bold text-zinc-500">{inlineSub}</span>}
      </div>
      {subValue && !inlineSub && <span className="text-xs font-bold text-zinc-500 mt-1">{subValue}</span>}
    </div>
  );
}

function BigStatCard({ title, stats, variant = "main" }: { title: string; stats: any; variant: "main" | "betting" | "trading" }) {
  const isPositive = stats.profit >= 0;
  const profitColor = isPositive ? "text-emerald-400" : "text-rose-400";
  let gradient = "", icon = null;

  if (variant === "main") {
    gradient = "from-emerald-900/40 via-zinc-900/60 to-zinc-900/60 border-emerald-500/30";
    icon = <Layers className="w-4 h-4 text-emerald-500" />;
  } else if (variant === "betting") {
    gradient = "from-sky-900/20 via-zinc-900/40 to-zinc-900/40 border-sky-500/20";
    icon = <Target className="w-4 h-4 text-sky-500" />;
  } else {
    gradient = "from-violet-900/20 via-zinc-900/40 to-zinc-900/40 border-violet-500/20";
    icon = <ArrowRightLeft className="w-4 h-4 text-violet-500" />;
  }

  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br ${gradient} backdrop-blur-xl overflow-hidden`}>
      <div className="p-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          {icon}
          <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">{title}</h3>
        </div>

        <div className="text-center mb-6">
          <div className={`text-5xl md:text-6xl font-black tracking-tight ${profitColor} drop-shadow-2xl`}>
            {eur(stats.profit)}
          </div>
          <div className="text-xs font-bold text-zinc-500 mt-2 uppercase tracking-wider">Neto Profit</div>
        </div>

        {variant !== "main" && (
           <div className="flex justify-center gap-6 mb-6 text-sm font-bold text-zinc-300 border-b border-white/5 pb-4">
              <span>PREMATCH: <span className={stats.preProfit >=0 ? "text-emerald-400":"text-rose-400"}>{eur(stats.preProfit)}</span></span>
              <span>LIVE: <span className={stats.liveProfit >=0 ? "text-emerald-400":"text-rose-400"}>{eur(stats.liveProfit)}</span></span>
           </div>
        )}

        {variant === "main" && (
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/5">
             <StatMetric label="Število Stav" value={stats.n} inlineSub={`${stats.wins}W - ${stats.losses}L`} icon={<Hash className="w-4 h-4" />} />
             <StatMetric label="Rast Kapitala" value={`${stats.growth >= 0 ? "+" : ""}${stats.growth.toFixed(1)}%`} color={stats.growth >= 0 ? "text-emerald-400" : "text-rose-400"} icon={<Percent className="w-4 h-4" />} />
             <StatMetric label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} color="text-zinc-200" icon={<Activity className="w-4 h-4" />} />
          </div>
        )}

        {variant !== "main" && (
          <div className={`grid ${variant === 'betting' ? 'grid-cols-4' : 'grid-cols-3'} gap-4 pt-2 border-t border-white/5`}>
             <StatMetric label="Število Stav" value={stats.n} inlineSub={`${stats.wins}W - ${stats.losses}L`} icon={<Hash className="w-4 h-4" />} />
             <StatMetric label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} color="text-zinc-200" icon={<Activity className="w-4 h-4" />} />
             
             {variant === "betting" && (
               <>
                 <StatMetric label="Povp. Kvota" value={stats.avgOdds.toFixed(2)} color="text-sky-400" icon={<Target className="w-4 h-4" />} />
                 <StatMetric label="ROI" value={`${stats.roi.toFixed(1)}%`} color={stats.roi >= 0 ? "text-emerald-400" : "text-rose-400"} icon={<TrendingUp className="w-4 h-4" />} />
               </>
             )}

             {variant === "trading" && (
                <StatMetric label="Rast Kap." value={`${stats.growth >= 0 ? "+" : ""}${stats.growth.toFixed(1)}%`} color={stats.growth >= 0 ? "text-emerald-400" : "text-rose-400"} icon={<Percent className="w-4 h-4" />} />
             )}
          </div>
        )}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", icon, placeholder }: any) {
  return (
    <div className="space-y-1 pointer-events-auto">
      <label className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase text-zinc-500">
        {icon} {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-2 bg-zinc-950/50 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700 text-center"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, icon }: any) {
  return (
    <div className="space-y-1 pointer-events-auto">
      <label className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase text-zinc-500">
        {icon} {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-2 appearance-none bg-zinc-950/50 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer text-center"
      >
        {options.map((opt: string) => <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>)}
      </select>
    </div>
  );
}

// --- GLAVNA STRAN ---
export default function StatsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedTipsters, setSelectedTipsters] = useState<string[]>([]);
  const [stavnica, setStavnica] = useState("ALL");
  const [cas, setCas] = useState<"ALL" | Cas>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minKvota, setMinKvota] = useState("");
  const [maxKvota, setMaxKvota] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({ sport: "ALL", tipster: "ALL", stavnica: "ALL", cas: "ALL" as "ALL"|Cas, fromDate: "", toDate: "", minKvota: "", maxKvota: "" });

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

  const totalStats = useMemo(() => buildStats(filteredRows), [filteredRows]);
  const bettingStats = useMemo(() => buildStats(bettingRows), [bettingRows]);
  const tradingStats = useMemo(() => buildStats(tradingRows), [tradingRows]);

  const tipsterBreakdown = useMemo(() => getBreakdown(filteredRows, 'tipster'), [filteredRows]);
  const sportBreakdown = useMemo(() => getBreakdown(filteredRows, 'sport'), [filteredRows]);
  // NOVO: Breakdown za PREMATCH / LIVE
  const casBreakdown = useMemo(() => getBreakdown(filteredRows, 'cas_stave'), [filteredRows]);

  const tipsterTotals = useMemo(() => {
    return tipsterBreakdown.reduce((acc, curr) => ({
      bet: acc.bet + curr.bettingProfit,
      trade: acc.trade + curr.tradingProfit,
      total: acc.total + curr.totalProfit
    }), { bet: 0, trade: 0, total: 0 });
  }, [tipsterBreakdown]);

  const sportTotals = useMemo(() => {
    return sportBreakdown.reduce((acc, curr) => ({
      bet: acc.bet + curr.bettingProfit,
      trade: acc.trade + curr.tradingProfit,
      total: acc.total + curr.totalProfit
    }), { bet: 0, trade: 0, total: 0 });
  }, [sportBreakdown]);

  const casTotals = useMemo(() => {
    return casBreakdown.reduce((acc, curr) => ({
      bet: acc.bet + curr.bettingProfit,
      trade: acc.trade + curr.tradingProfit,
      total: acc.total + curr.totalProfit
    }), { bet: 0, trade: 0, total: 0 });
  }, [casBreakdown]);

  const handleClearFilters = () => {
    setSelectedSports([]); setSelectedTipsters([]); setStavnica("ALL"); setCas("ALL"); setFromDate(""); setToDate(""); setMinKvota(""); setMaxKvota("");
  };

  const hasActiveFilters = selectedSports.length > 0 || selectedTipsters.length > 0 || stavnica !== "ALL" || cas !== "ALL" || fromDate !== "" || toDate !== "" || minKvota !== "" || maxKvota !== "";

  if (loading && rows.length === 0) return <div className="min-h-screen flex items-center justify-center bg-black"><div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      
      <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 pb-10">
        
        {/* FILTER BAR - POPRAVEK: pt-32 (bolj dol) in z-[60] (klikabilno) */}
        <div className="pt-32 pb-6 flex justify-end relative z-[60] pointer-events-none">
           <div className="flex gap-2 pointer-events-auto">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all cursor-pointer shadow-lg active:scale-95 ${filtersOpen ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'}`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Filtri</span>
              {hasActiveFilters && <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>}
            </button>
            <button onClick={loadRows} className="p-2.5 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all cursor-pointer shadow-lg active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* FILTERS DROPDOWN */}
        <div className={`transition-all duration-300 ease-in-out relative z-40 ${filtersOpen ? 'opacity-100 mb-8' : 'max-h-0 opacity-0 mb-0 overflow-hidden'}`}>
          <div className="p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-xl">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
              <InputField label="Od" value={fromDate} onChange={setFromDate} type="date" icon={<Calendar className="w-3 h-3" />} />
              <InputField label="Do" value={toDate} onChange={setToDate} type="date" icon={<Calendar className="w-3 h-3" />} />
              <MultiSelectField label="Športi" options={SPORTI} selected={selectedSports} onChange={setSelectedSports} icon={<Activity className="w-3 h-3" />} />
              <MultiSelectField label="Tipsterji" options={TIPSTERJI} selected={selectedTipsters} onChange={setSelectedTipsters} icon={<Users className="w-3 h-3" />} />
              <SelectField label="Stavnica" value={stavnica} onChange={setStavnica} options={["ALL", ...STAVNICE]} icon={<Building2 className="w-3 h-3" />} />
              <SelectField label="Čas" value={cas} onChange={setCas} options={["ALL", "PREMATCH", "LIVE"]} icon={<Clock className="w-3 h-3" />} />
              <InputField label="Min Kvota" value={minKvota} onChange={setMinKvota} placeholder="1.00" icon={<Scale className="w-3 h-3" />} />
              <InputField label="Max Kvota" value={maxKvota} onChange={setMaxKvota} placeholder="10.00" icon={<Scale className="w-3 h-3" />} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <button onClick={handleClearFilters} className="px-4 py-2 text-xs font-bold uppercase text-zinc-500 hover:text-white cursor-pointer">Počisti</button>
              <button onClick={() => setFiltersOpen(false)} className="px-6 py-2 bg-white text-black text-xs font-bold uppercase rounded-lg hover:bg-zinc-200 cursor-pointer">Zapri</button>
            </div>
          </div>
        </div>

        {/* --- STATISTIČNE KARTICE --- */}
        <section className="space-y-6 mb-12">
          <BigStatCard title="Skupna Statistika" stats={totalStats} variant="main" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BigStatCard title="Betting" stats={bettingStats} variant="betting" />
            <BigStatCard title="Trading" stats={tradingStats} variant="trading" />
          </div>
        </section>

        {/* --- BREAKDOWN LISTE (Tipsterji & Športi) --- */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
            
            {/* TIPSTER BREAKDOWN */}
            <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-5 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                    <Users className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Tipsterji</h3>
                </div>
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                    <div className="grid grid-cols-4 text-[10px] font-bold text-zinc-500 uppercase px-2 mb-2 sticky top-0 bg-[#09090b] z-10 py-2">
                        <span>Ime</span>
                        <span className="text-right text-sky-500">Bet Profit</span>
                        <span className="text-right text-violet-500">Trad Profit</span>
                        <span className="text-right text-white">Skupaj</span>
                    </div>
                    {tipsterBreakdown.map(t => (
                        <div key={t.name} className="grid grid-cols-4 text-xs px-2 py-2 hover:bg-white/5 rounded transition-colors border-b border-white/5 last:border-0">
                            <span className="font-bold text-zinc-300">{t.name} <span className="text-[9px] text-zinc-600 font-normal">({t.count})</span></span>
                            <span className={`text-right font-mono ${t.bettingProfit>=0?"text-sky-400":"text-rose-400"}`}>{eurDec(t.bettingProfit)}</span>
                            <span className={`text-right font-mono ${t.tradingProfit>=0?"text-violet-400":"text-rose-400"}`}>{eurDec(t.tradingProfit)}</span>
                            <span className={`text-right font-mono font-bold ${t.totalProfit>=0?"text-emerald-400":"text-rose-400"}`}>{eurDec(t.totalProfit)}</span>
                        </div>
                    ))}
                </div>
                {/* FOOTER - SALDO */}
                <div className="mt-2 pt-3 border-t border-zinc-700 grid grid-cols-4 text-xs font-black uppercase px-2 bg-zinc-900/50 py-2 rounded-b-xl">
                    <span className="text-zinc-400">SKUPAJ</span>
                    <span className={`text-right font-mono ${tipsterTotals.bet>=0?"text-sky-400":"text-rose-400"}`}>{eurDec(tipsterTotals.bet)}</span>
                    <span className={`text-right font-mono ${tipsterTotals.trade>=0?"text-violet-400":"text-rose-400"}`}>{eurDec(tipsterTotals.trade)}</span>
                    <span className={`text-right font-mono text-emerald-400`}>{eurDec(tipsterTotals.total)}</span>
                </div>
            </div>

            {/* SPORT BREAKDOWN */}
            <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-5 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Športi</h3>
                </div>
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                    <div className="grid grid-cols-4 text-[10px] font-bold text-zinc-500 uppercase px-2 mb-2 sticky top-0 bg-[#09090b] z-10 py-2">
                        <span>Šport</span>
                        <span className="text-right text-sky-500">Bet Profit</span>
                        <span className="text-right text-violet-500">Trad Profit</span>
                        <span className="text-right text-white">Skupaj</span>
                    </div>
                    {sportBreakdown.map(t => (
                        <div key={t.name} className="grid grid-cols-4 text-xs px-2 py-2 hover:bg-white/5 rounded transition-colors border-b border-white/5 last:border-0">
                            <span className="font-bold text-zinc-300">{t.name} <span className="text-[9px] text-zinc-600 font-normal">({t.count})</span></span>
                            <span className={`text-right font-mono ${t.bettingProfit>=0?"text-sky-400":"text-rose-400"}`}>{eurDec(t.bettingProfit)}</span>
                            <span className={`text-right font-mono ${t.tradingProfit>=0?"text-violet-400":"text-rose-400"}`}>{eurDec(t.tradingProfit)}</span>
                            <span className={`text-right font-mono font-bold ${t.totalProfit>=0?"text-emerald-400":"text-rose-400"}`}>{eurDec(t.totalProfit)}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 pt-3 border-t border-zinc-700 grid grid-cols-4 text-xs font-black uppercase px-2 bg-zinc-900/50 py-2 rounded-b-xl">
                    <span className="text-zinc-400">SKUPAJ</span>
                    <span className={`text-right font-mono ${sportTotals.bet>=0?"text-sky-400":"text-rose-400"}`}>{eurDec(sportTotals.bet)}</span>
                    <span className={`text-right font-mono ${sportTotals.trade>=0?"text-violet-400":"text-rose-400"}`}>{eurDec(sportTotals.trade)}</span>
                    <span className={`text-right font-mono text-emerald-400`}>{eurDec(sportTotals.total)}</span>
                </div>
            </div>
        </section>

        {/* --- GRAF + PREMATCH/LIVE STATS --- */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* CUMULATIVE AREA CHART */}
          <div className="lg:col-span-2 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-6">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Kumulativni Profit</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={totalStats.chartData}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(value: number | undefined) => [eurDec(value || 0), "Profit"]}
                  />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PREMATCH / LIVE BREAKDOWN (Zamenjava za mesečni graf) */}
          <div className="lg:col-span-1 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-5 flex flex-col h-full">
             <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Prematch / Live</h3>
             </div>
             <div className="flex-1 space-y-1">
                <div className="grid grid-cols-4 text-[10px] font-bold text-zinc-500 uppercase px-2 mb-2">
                    <span>Tip</span>
                    <span className="text-right text-sky-500">Bet P.</span>
                    <span className="text-right text-violet-500">Trad P.</span>
                    <span className="text-right text-white">Skupaj</span>
                </div>
                {casBreakdown.map(t => (
                    <div key={t.name} className="grid grid-cols-4 text-xs px-2 py-3 hover:bg-white/5 rounded transition-colors border-b border-white/5 last:border-0">
                        <span className="font-bold text-zinc-300">{t.name} <span className="text-[9px] text-zinc-600 font-normal">({t.count})</span></span>
                        <span className={`text-right font-mono ${t.bettingProfit>=0?"text-sky-400":"text-rose-400"}`}>{eurDec(t.bettingProfit)}</span>
                        <span className={`text-right font-mono ${t.tradingProfit>=0?"text-violet-400":"text-rose-400"}`}>{eurDec(t.tradingProfit)}</span>
                        <span className={`text-right font-mono font-bold ${t.totalProfit>=0?"text-emerald-400":"text-rose-400"}`}>{eurDec(t.totalProfit)}</span>
                    </div>
                ))}
             </div>
             {/* FOOTER - SALDO */}
             <div className="mt-auto pt-3 border-t border-zinc-700 grid grid-cols-4 text-xs font-black uppercase px-2 bg-zinc-900/50 py-2 rounded-b-xl">
                <span className="text-zinc-400">SKUPAJ</span>
                <span className={`text-right font-mono ${casTotals.bet>=0?"text-sky-400":"text-rose-400"}`}>{eurDec(casTotals.bet)}</span>
                <span className={`text-right font-mono ${casTotals.trade>=0?"text-violet-400":"text-rose-400"}`}>{eurDec(casTotals.trade)}</span>
                <span className={`text-right font-mono text-emerald-400`}>{eurDec(casTotals.total)}</span>
             </div>
          </div>
        </section>

        {/* --- ZADNJE STAVE TABELA --- */}
        <section className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-800/50">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Zadnje Aktivnosti</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-zinc-950/50 text-zinc-500 uppercase tracking-wider">
                  <th className="p-3 text-center">Datum</th>
                  <th className="p-3 text-center">Mode</th>
                  <th className="p-3 text-center">Dogodek</th>
                  <th className="p-3 text-center">Tipster</th>
                  <th className="p-3 text-center">Čas</th>
                  <th className="p-3 text-center">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {totalStats.settled.slice().reverse().slice(0, 20).map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="p-3 text-zinc-400 text-center">{new Date(row.datum).toLocaleDateString("sl-SI")}</td>
                    <td className="p-3 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getMode(row) === 'TRADING' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}>{getMode(row)}</span></td>
                    <td className="p-3 text-zinc-300 text-center">{row.dogodek || "-"}</td>
                    <td className="p-3 text-center"><span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">{row.tipster}</span></td>
                    <td className="p-3 text-center text-zinc-500">{row.cas_stave}</td>
                    <td className={`p-3 text-center font-mono font-bold ${calcProfit(row) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eurDec(calcProfit(row))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}