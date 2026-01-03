"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  Cell
} from "recharts";
import {
  Calendar,
  Filter,
  Users,
  Building2,
  Clock,
  Activity,
  RefreshCw,
  Layers,
  Target,
  TrendingUp,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Scale
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
  SHARP: 2000,
  PINNACLE: 2000,
  BET365: 2000,
  WINAMAX: 1000,
  WWIN: 500,
  "E-STAVE": 500,
  "BET AT HOME": 1000,
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

function getMode(b: Bet): Mode {
  if (b.mode) return b.mode;
  return hasBack(b) && hasLay(b) ? "TRADING" : "BET";
}

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

  if (!hasBackBet && hasLayBet) {
    if (b.wl === "WIN") return layStake - kom;
    return -layLiability - kom;
  }
  if (hasBackBet && !hasLayBet) {
    if (b.wl === "WIN") return backStake * (backOdds - 1) - kom;
    return -backStake - kom;
  }
  if (hasBackBet && hasLayBet) {
    if (b.wl === "WIN") return backStake * (backOdds - 1) - layLiability - kom;
    return -backStake + layStake - kom;
  }
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
  
  // Growth (Donos na začetni kapital)
  const growth = (profit / TOTAL_START_BANK) * 100;

  // Povprečna kvota (samo za Betting Back stave relevantno)
  const avgOdds = n > 0 
    ? settled.reduce((acc, r) => acc + (r.kvota1 || 0), 0) / n 
    : 0;

  // Chart Data - Cumulative
  let runningProfit = 0;
  const chartData = settled
    .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())
    .map((b) => {
      const p = calcProfit(b);
      runningProfit += p;
      return {
        date: new Date(b.datum).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' }),
        fullDate: b.datum,
        profit: runningProfit,
        daily: p
      };
    });

  // Monthly Data for Bar Chart
  const monthlyMap = new Map<string, number>();
  settled.forEach(b => {
    const d = new Date(b.datum);
    const key = d.toLocaleDateString('sl-SI', { month: 'short', year: '2-digit' }); // npr "jan 26"
    // Za sortiranje rabimo YYYY-MM
    const sortKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`; 
    monthlyMap.set(sortKey, (monthlyMap.get(sortKey) || 0) + calcProfit(b));
  });

  const monthlyChartData = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sortKey, val]) => {
      const [y, m] = sortKey.split('-');
      const dateObj = new Date(Number(y), Number(m)-1, 1);
      return {
        name: dateObj.toLocaleDateString('sl-SI', { month: 'short', year: '2-digit' }),
        profit: val
      };
    });

  return { 
    profit, n, wins, losses, roi, winRate, growth, avgOdds, 
    chartData, monthlyChartData, settled 
  };
}

// --- KOMPONENTE ---

function StatMetric({ label, value, subValue, color = "text-white", icon }: any) {
  return (
    <div className="flex flex-col items-center justify-center p-2">
      <div className="flex items-center gap-1 mb-1 text-zinc-500">
        {icon}
        <span className="text-[10px] font-bold tracking-widest uppercase">{label}</span>
      </div>
      <span className={`text-2xl md:text-3xl font-black ${color}`}>{value}</span>
      {subValue && <span className="text-xs font-medium text-zinc-500 mt-1">{subValue}</span>}
    </div>
  );
}

function BigStatCard({ 
  title, 
  stats, 
  variant = "main" // main, betting, trading
}: { 
  title: string; 
  stats: any;
  variant: "main" | "betting" | "trading";
}) {
  const isPositive = stats.profit >= 0;
  const profitColor = isPositive ? "text-emerald-400" : "text-rose-400";
  
  let gradient = "";
  let icon = null;

  if (variant === "main") {
    gradient = "from-emerald-900/40 via-zinc-900/60 to-zinc-900/60 border-emerald-500/30";
    icon = <Layers className="w-5 h-5 text-emerald-500" />;
  } else if (variant === "betting") {
    gradient = "from-sky-900/20 via-zinc-900/40 to-zinc-900/40 border-sky-500/20";
    icon = <Target className="w-4 h-4 text-sky-500" />;
  } else {
    gradient = "from-violet-900/20 via-zinc-900/40 to-zinc-900/40 border-violet-500/20";
    icon = <Scale className="w-4 h-4 text-violet-500" />;
  }

  return (
    <div className={`relative rounded-3xl border bg-gradient-to-br ${gradient} backdrop-blur-xl overflow-hidden`}>
      {/* Header */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-20" />
      
      <div className="p-6">
        <div className="flex items-center justify-center gap-2 mb-6">
          {icon}
          <h3 className="text-sm font-bold tracking-[0.2em] text-zinc-400 uppercase">{title}</h3>
        </div>

        {/* Glavni Profit */}
        <div className="text-center mb-8">
          <div className={`text-5xl md:text-6xl font-black tracking-tight ${profitColor} drop-shadow-2xl`}>
            {eur(stats.profit)}
          </div>
          <div className="text-sm font-bold text-zinc-500 mt-2 uppercase tracking-wider">Neto Profit</div>
        </div>

        {/* Grid Statistike */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 border-t border-white/5 pt-6">
          
          <StatMetric 
            label="Število Stav" 
            value={stats.n} 
            subValue={`${stats.wins}W - ${stats.losses}L`}
            icon={<Layers className="w-3 h-3" />}
          />

          <StatMetric 
            label="Win Rate" 
            value={`${stats.winRate.toFixed(0)}%`}
            color="text-zinc-200"
            icon={<Activity className="w-3 h-3" />}
          />

          {variant === "betting" && (
            <StatMetric 
              label="Povprečna Kvota" 
              value={stats.avgOdds.toFixed(2)}
              color="text-sky-400"
              icon={<Target className="w-3 h-3" />}
            />
          )}

          {/* ROI je samo za betting/trading relevanten v tem kontekstu */}
          {(variant === "betting" || variant === "trading") && (
            <StatMetric 
              label="ROI" 
              value={`${stats.roi.toFixed(1)}%`}
              color={stats.roi >= 0 ? "text-emerald-400" : "text-rose-400"}
              icon={<TrendingUp className="w-3 h-3" />}
            />
          )}

          <StatMetric 
            label="Rast Kapitala" 
            value={`${stats.growth >= 0 ? "+" : ""}${stats.growth.toFixed(1)}%`}
            color={stats.growth >= 0 ? "text-emerald-400" : "text-rose-400"}
            icon={<Percent className="w-3 h-3" />}
          />

        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", icon }: any) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase text-zinc-500">
        {icon} {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-2 bg-zinc-950/50 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, icon }: any) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase text-zinc-500">
        {icon} {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-2 appearance-none bg-zinc-950/50 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
      >
        {options.map((opt: string) => (
          <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>
        ))}
      </select>
    </div>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filtri
  const [sport, setSport] = useState("ALL");
  const [tipster, setTipster] = useState("ALL");
  const [stavnica, setStavnica] = useState("ALL");
  const [cas, setCas] = useState<"ALL" | Cas>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ sport: "ALL", tipster: "ALL", stavnica: "ALL", cas: "ALL" as "ALL"|Cas, fromDate: "", toDate: "" });

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
      if (appliedFilters.sport !== "ALL" && r.sport !== appliedFilters.sport) return false;
      if (appliedFilters.tipster !== "ALL" && r.tipster !== appliedFilters.tipster) return false;
      if (appliedFilters.stavnica !== "ALL" && r.stavnica !== appliedFilters.stavnica) return false;
      if (appliedFilters.cas !== "ALL" && r.cas_stave !== appliedFilters.cas) return false;
      if (appliedFilters.fromDate && r.datum < appliedFilters.fromDate) return false;
      if (appliedFilters.toDate && r.datum > appliedFilters.toDate) return false;
      return true;
    });
  }, [rows, appliedFilters]);

  const bettingRows = useMemo(() => filteredRows.filter(r => getMode(r) === "BET"), [filteredRows]);
  const tradingRows = useMemo(() => filteredRows.filter(r => getMode(r) === "TRADING"), [filteredRows]);

  const totalStats = useMemo(() => buildStats(filteredRows), [filteredRows]);
  const bettingStats = useMemo(() => buildStats(bettingRows), [bettingRows]);
  const tradingStats = useMemo(() => buildStats(tradingRows), [tradingRows]);

  const handleApplyFilters = () => {
    setAppliedFilters({ sport, tipster, stavnica, cas, fromDate, toDate });
    setFiltersOpen(false);
  };

  const handleClearFilters = () => {
    setSport("ALL"); setTipster("ALL"); setStavnica("ALL"); setCas("ALL"); setFromDate(""); setToDate("");
    setAppliedFilters({ sport: "ALL", tipster: "ALL", stavnica: "ALL", cas: "ALL", fromDate: "", toDate: "" });
  };

  const hasActiveFilters = JSON.stringify(appliedFilters) !== JSON.stringify({ sport: "ALL", tipster: "ALL", stavnica: "ALL", cas: "ALL", fromDate: "", toDate: "" });

  if (loading && rows.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />

      <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">Analytics Dashboard</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">Statistika & Pregled</h1>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${filtersOpen ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white'}`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Filtri</span>
              {hasActiveFilters && <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>}
            </button>
            <button onClick={loadRows} className="p-2.5 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {/* FILTERS DROPDOWN */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${filtersOpen ? 'max-h-[500px] opacity-100 mb-8' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <InputField label="Od" value={fromDate} onChange={setFromDate} type="date" icon={<Calendar className="w-3 h-3" />} />
              <InputField label="Do" value={toDate} onChange={setToDate} type="date" icon={<Calendar className="w-3 h-3" />} />
              <SelectField label="Šport" value={sport} onChange={setSport} options={["ALL", ...SPORTI]} icon={<Target className="w-3 h-3" />} />
              <SelectField label="Tipster" value={tipster} onChange={setTipster} options={["ALL", ...TIPSTERJI]} icon={<Users className="w-3 h-3" />} />
              <SelectField label="Stavnica" value={stavnica} onChange={setStavnica} options={["ALL", ...STAVNICE]} icon={<Building2 className="w-3 h-3" />} />
              <SelectField label="Čas" value={cas} onChange={setCas} options={["ALL", "PREMATCH", "LIVE"]} icon={<Clock className="w-3 h-3" />} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <button onClick={handleClearFilters} className="px-4 py-2 text-xs font-bold uppercase text-zinc-500 hover:text-white">Počisti</button>
              <button onClick={handleApplyFilters} className="px-6 py-2 bg-white text-black text-xs font-bold uppercase rounded-lg hover:bg-zinc-200">Uporabi</button>
            </div>
          </div>
        </div>

        {/* --- GLAVNA STATISTIKA (GRID) --- */}
        <section className="space-y-6 mb-12">
          
          {/* 1. VRSTICA: SKUPNA STATISTIKA */}
          <BigStatCard title="Skupna Statistika" stats={totalStats} variant="main" />

          {/* 2. VRSTICA: BETTING & TRADING SPLIT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BigStatCard title="Betting" stats={bettingStats} variant="betting" />
            <BigStatCard title="Trading" stats={tradingStats} variant="trading" />
          </div>

        </section>

        {/* --- GRAFI --- */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          
          {/* CUMULATIVE AREA CHART (Zavzame 2/3 širine na velikih ekranih) */}
          <div className="lg:col-span-2 rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Rast Profita</h3>
                
                <p className="text-xs text-zinc-500 mt-1">Kumulativni pregled uspešnosti</p>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-black ${totalStats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {eurDec(totalStats.profit)}
                </span>
              </div>
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
                  <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => [eurDec(value), "Profit"]}
                  />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* MONTHLY BAR CHART (Zavzame 1/3 širine) */}
          <div className="lg:col-span-1 rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-6">
            <div className="mb-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Mesečni Donos</h3>
              
              <p className="text-xs text-zinc-500 mt-1">Uspešnost po mesecih</p>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={totalStats.monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(value: number) => [eurDec(value), "Profit"]}
                  />
                  <ReferenceLine y={0} stroke="#52525b" />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                    {totalStats.monthlyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </section>

        {/* --- ZADNJE STAVE --- */}
        <section className="rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-800/50 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">Zadnje Aktivnosti</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-zinc-950/50 text-zinc-500 uppercase tracking-wider">
                  <th className="p-4 font-bold text-center">Datum</th>
                  <th className="p-4 font-bold text-center">Mode</th>
                  <th className="p-4 font-bold text-center">Šport</th>
                  <th className="p-4 font-bold text-center">Tipster</th>
                  <th className="p-4 font-bold text-center">Stavnica</th>
                  <th className="p-4 font-bold text-center">Status</th>
                  <th className="p-4 font-bold text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {totalStats.settled.slice().reverse().slice(0, 10).map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4 text-zinc-300 text-center">{new Date(row.datum).toLocaleDateString("sl-SI")}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${
                        getMode(row) === 'TRADING' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                      }`}>
                        {getMode(row)}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400 text-center">{row.sport}</td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 rounded bg-zinc-900 text-[10px] font-bold text-zinc-400 border border-zinc-800">{row.tipster}</span>
                    </td>
                    <td className="p-4 text-zinc-400 text-center">{row.stavnica}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${
                        row.wl === 'WIN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        row.wl === 'LOSS' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                        'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}>
                        {row.wl}
                      </span>
                    </td>
                    <td className={`p-4 text-right font-mono text-sm font-bold ${calcProfit(row) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {eurDec(calcProfit(row))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-12 pt-8 border-t border-zinc-900 text-center flex flex-col md:flex-row justify-between items-center text-zinc-600 text-xs gap-2">
          <p>© 2024 DDTips Analytics. Vse pravice pridržane.</p>
          <p className="font-mono">Last updated: {new Date().toLocaleTimeString()}</p>
        </footer>
      </div>
    </main>
  );
}