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
  ResponsiveContainer
} from "recharts";
import {
  TrendingUp,
  Target,
  Trophy,
  Calendar,
  Filter,
  Users,
  Building2,
  Clock,
  Activity,
  Percent,
  Zap,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Table as TableIcon
} from "lucide-react";

// --- TYPES ---
type WL = "OPEN" | "WIN" | "LOSS" | "VOID";
type Cas = "PREMATCH" | "LIVE";

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
};

// --- CONSTANTS ---
const BOOK_START: Record<string, number> = {
  SHARP: 2000,
  PINNACLE: 2000,
  BET365: 2000,
  WINAMAX: 1000,
};

const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"];
const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"];
const STAVNICE = ["SHARP", "PINNACLE", "BET365", "WINAMAX", "WWIN", "BET AT HOME", "E - STAVE"];

// --- UTILS ---
function normBook(x: string) {
  return (x || "").toUpperCase().replace(/\s+/g, "");
}

function eur(n: number) {
  return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR" });
}

function hasLay(b: Bet) {
  return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0;
}

function hasBack(b: Bet) {
  return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0;
}

function calcEffectiveOdds(b: Bet): number | null {
  const hasBackBet = hasBack(b);
  const hasLayBet = hasLay(b);
  
  if (hasBackBet && !hasLayBet) {
    return b.kvota1;
  }
  
  if (!hasBackBet && hasLayBet) {
    const layLiability = (b.lay_kvota - 1) * b.vplacilo2;
    if (layLiability <= 0) return null;
    return b.vplacilo2 / layLiability + 1;
  }
  
  if (hasBackBet && hasLayBet) {
    const layLiability = (b.lay_kvota - 1) * b.vplacilo2;
    const netStake = b.vplacilo1 - b.vplacilo2;
    const potentialWin = (b.kvota1 - 1) * b.vplacilo1 - layLiability;
    
    if (netStake <= 0) return null;
    return potentialWin / netStake + 1;
  }
  
  return null;
}

function calcProfit(b: Bet): number {
  const kom = b.komisija || 0;
  if (b.wl !== "WIN" && b.wl !== "LOSS") return 0;

  const hasBackBet = hasBack(b);
  const hasLayBet = hasLay(b);

  if (!hasBackBet && hasLayBet) {
    const layLiability = (b.lay_kvota - 1) * b.vplacilo2;
    if (b.wl === "WIN") {
      return b.vplacilo2 - kom;
    } else {
      return -layLiability - kom;
    }
  }

  if (hasBackBet && !hasLayBet) {
    if (b.wl === "WIN") return b.vplacilo1 * (b.kvota1 - 1) - kom;
    if (b.wl === "LOSS") return -b.vplacilo1 - kom;
    return 0;
  }

  if (hasBackBet && hasLayBet) {
    const layLiability = (b.lay_kvota - 1) * b.vplacilo2;
    
    if (b.wl === "WIN") {
      return b.vplacilo1 * (b.kvota1 - 1) - layLiability - kom;
    } else {
      return -b.vplacilo1 + b.vplacilo2 - kom;
    }
  }

  return 0;
}

function buildStats(rows: Bet[]) {
  const settled = rows.filter((r) => r.wl === "WIN" || r.wl === "LOSS");

  const n = settled.length;
  const wins = settled.filter((r) => r.wl === "WIN").length;
  const losses = settled.filter((r) => r.wl === "LOSS").length;
  const profit = settled.reduce((acc, r) => acc + calcProfit(r), 0);
  
  const effectiveOdds = settled.map(r => calcEffectiveOdds(r)).filter(o => o !== null) as number[];
  const avgOdds = effectiveOdds.length > 0 
    ? effectiveOdds.reduce((acc, o) => acc + o, 0) / effectiveOdds.length 
    : 0;
  
  const totalStaked = settled.reduce((acc, r) => {
    if (hasBack(r)) return acc + r.vplacilo1;
    if (hasLay(r)) return acc + r.vplacilo2;
    return acc;
  }, 0);
  const roi = totalStaked === 0 ? 0 : profit / totalStaked;
  
  const winRate = n > 0 ? (wins / n) * 100 : 0;

  let runningProfit = 0;
  const chartData = settled
    .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())
    .map((b) => {
      const p = calcProfit(b);
      runningProfit += p;
      const date = new Date(b.datum);
      return {
        date: date.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' }),
        monthName: date.toLocaleDateString('sl-SI', { month: 'short', year: '2-digit' }),
        fullDate: b.datum,
        profit: runningProfit,
        daily: p
      };
    });

  const profitByBook = new Map<string, number>();
  settled.forEach((r) => {
    const key = normBook(r.stavnica || "NEZNANO");
    profitByBook.set(key, (profitByBook.get(key) ?? 0) + calcProfit(r));
  });

  const balanceByBook: { name: string; start: number; profit: number; balance: number }[] = [];
  Object.entries(BOOK_START).forEach(([name, start]) => {
    const p = profitByBook.get(name) ?? 0;
    balanceByBook.push({ name, start, profit: p, balance: start + p });
  });
  
  profitByBook.forEach((val, key) => {
    if (!BOOK_START[key]) {
        balanceByBook.push({ name: key, start: 0, profit: val, balance: val });
    }
  });

  balanceByBook.sort((a, b) => b.balance - a.balance);

  return { profit, n, wins, losses, avgOdds, roi, chartData, balanceByBook, winRate, settled };
}

function buildStatsByCategory(rows: Bet[], category: 'tipster' | 'sport' | 'cas_stave') {
  const map = new Map<string, Bet[]>();
  rows.forEach((r) => {
    const key = r[category] || "NEZNANO";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  });

  return Array.from(map.entries()).map(([name, bets]) => {
    const stats = buildStats(bets);
    return { name, ...stats };
  }).sort((a, b) => b.profit - a.profit);
}

function MetricCard({ 
  title, 
  value, 
  subtitle,
  trend,
  icon,
  accentColor = "emerald",
  big = false
}: { 
  title: string; 
  value: string; 
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  accentColor?: "emerald" | "amber" | "rose" | "sky" | "violet";
  big?: boolean;
}) {
  const gradients = {
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:border-amber-500/40",
    rose: "from-rose-500/10 to-rose-500/5 border-rose-500/20 hover:border-rose-500/40",
    sky: "from-sky-500/10 to-sky-500/5 border-sky-500/20 hover:border-sky-500/40",
    violet: "from-violet-500/10 to-violet-500/5 border-violet-500/20 hover:border-violet-500/40",
  };

  const textColors = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    sky: "text-sky-400",
    violet: "text-violet-400",
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradients[accentColor]} border backdrop-blur-md transition-all duration-300 hover:-translate-y-1`}>
      <div className="p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className={`p-2 rounded-lg bg-white/5 ${textColors[accentColor]}`}>
            {icon}
          </div>
          <span className="text-xs font-bold tracking-wider uppercase text-zinc-500">{title}</span>
        </div>
        
        <div className="flex items-center justify-center gap-3">
          <span className={`${big ? "text-3xl md:text-4xl" : "text-2xl"} font-bold tracking-tight text-white`}>
            {value}
          </span>
          {trend && trend !== "neutral" && (
            <div className={`flex items-center text-sm font-medium ${trend === "up" ? "text-emerald-400" : "text-rose-400"}`}>
              {trend === "up" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
          )}
        </div>
        
        {subtitle && (
          <p className="mt-2 text-sm text-zinc-400 font-medium">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function InputField({ 
  label, 
  value, 
  onChange, 
  type = "text", 
  icon 
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void; 
  type?: string; 
  icon?: React.ReactNode 
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest uppercase text-zinc-500">
        {icon} {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-950/50 border border-zinc-800 rounded-lg text-zinc-200 text-sm text-center focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-700"
      />
    </div>
  );
}

function SelectField({ 
  label, 
  value, 
  onChange, 
  options, 
  icon 
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void; 
  options: string[]; 
  icon?: React.ReactNode 
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest uppercase text-zinc-500">
        {icon} {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-3 pr-8 py-2 appearance-none bg-zinc-950/50 border border-zinc-800 rounded-lg text-zinc-200 text-sm text-center focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [sport, setSport] = useState("ALL");
  const [tipster, setTipster] = useState("ALL");
  const [stavnica, setStavnica] = useState("ALL");
  const [cas, setCas] = useState<"ALL" | Cas>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [oddsFilter, setOddsFilter] = useState<"ALL" | "OVER" | "UNDER">("ALL");
  const [oddsValue, setOddsValue] = useState("2");

  const [appliedFilters, setAppliedFilters] = useState({
    sport: "ALL",
    tipster: "ALL",
    stavnica: "ALL",
    cas: "ALL" as "ALL" | Cas,
    fromDate: "",
    toDate: "",
    oddsFilter: "ALL" as "ALL" | "OVER" | "UNDER",
    oddsValue: "2",
  });

  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    (async () => {
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
    setMsg(null);
    const { data, error } = await supabase
      .from("bets")
      .select("*")
      .order("datum", { ascending: true });
    setLoading(false);
    if (error) return setMsg(error.message);
    setRows((data ?? []) as Bet[]);
  }

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (appliedFilters.sport !== "ALL" && r.sport !== appliedFilters.sport) return false;
      if (appliedFilters.tipster !== "ALL" && r.tipster !== appliedFilters.tipster) return false;
      if (appliedFilters.stavnica !== "ALL" && r.stavnica !== appliedFilters.stavnica) return false;
      if (appliedFilters.cas !== "ALL" && r.cas_stave !== appliedFilters.cas) return false;
      if (appliedFilters.fromDate && r.datum < appliedFilters.fromDate) return false;
      if (appliedFilters.toDate && r.datum > appliedFilters.toDate) return false;
      
      if (appliedFilters.oddsFilter !== "ALL") {
        const effOdds = calcEffectiveOdds(r);
        const threshold = parseFloat(appliedFilters.oddsValue);
        if (effOdds === null) return true;
        if (appliedFilters.oddsFilter === "OVER" && effOdds <= threshold) return false;
        if (appliedFilters.oddsFilter === "UNDER" && effOdds >= threshold) return false;
      }
      return true;
    });
  }, [rows, appliedFilters]);

  const stats = useMemo(() => buildStats(filteredRows), [filteredRows]);
  const statsByTipster = useMemo(() => buildStatsByCategory(filteredRows, 'tipster'), [filteredRows]);
  const statsBySport = useMemo(() => buildStatsByCategory(filteredRows, 'sport'), [filteredRows]);

  const handleApplyFilters = () => {
    setAppliedFilters({ sport, tipster, stavnica, cas, fromDate, toDate, oddsFilter, oddsValue });
    setFiltersOpen(false);
  };

  const handleClearFilters = () => {
    setSport("ALL"); setTipster("ALL"); setStavnica("ALL"); setCas("ALL");
    setFromDate(""); setToDate(""); setOddsFilter("ALL"); setOddsValue("2");
    setAppliedFilters({ sport: "ALL", tipster: "ALL", stavnica: "ALL", cas: "ALL", fromDate: "", toDate: "", oddsFilter: "ALL", oddsValue: "2" });
  };

  if (loading && rows.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-zinc-500 text-xs font-bold tracking-widest uppercase animate-pulse">Loading Data</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />

      <div className="relative max-w-[1400px] mx-auto px-4 md:px-8 py-8 md:py-12">
        
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-xs font-bold text-emerald-500 tracking-widest uppercase">Live Dashboard</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
              Statistika <span className="text-zinc-600">Performance</span>
            </h1>
            <p className="text-zinc-400 font-medium">Pregled donosnosti in analitika stav</p>
          </div>
          
          <div className="flex items-center justify-center md:justify-end gap-3">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all duration-200 ${filtersOpen ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'}`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm font-semibold">Filtri</span>
            </button>
            <button
              onClick={loadRows}
              className="group p-3 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all duration-200 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)]"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
            </button>
          </div>
        </header>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${filtersOpen ? 'max-h-[500px] opacity-100 mb-8' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl">
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
                <InputField label="Od" value={fromDate} onChange={setFromDate} type="date" icon={<Calendar className="w-3 h-3" />} />
                <InputField label="Do" value={toDate} onChange={setToDate} type="date" icon={<Calendar className="w-3 h-3" />} />
                <SelectField label="Šport" value={sport} onChange={setSport} options={["ALL", ...SPORTI]} icon={<Target className="w-3 h-3" />} />
                <SelectField label="Tipster" value={tipster} onChange={setTipster} options={["ALL", ...TIPSTERJI]} icon={<Users className="w-3 h-3" />} />
                <SelectField label="Stavnica" value={stavnica} onChange={setStavnica} options={["ALL", ...STAVNICE]} icon={<Building2 className="w-3 h-3" />} />
                <SelectField label="Čas" value={cas} onChange={(v: string) => setCas(v as "ALL" | Cas)} options={["ALL", "PREMATCH", "LIVE"]} icon={<Clock className="w-3 h-3" />} />
                <SelectField label="Efekt. Kvota" value={oddsFilter} onChange={(v: string) => setOddsFilter(v as "ALL" | "OVER" | "UNDER")} options={["ALL", "OVER", "UNDER"]} icon={<TrendingUp className="w-3 h-3" />} />
                <InputField label="Vrednost" value={oddsValue} onChange={setOddsValue} type="number" icon={<Zap className="w-3 h-3" />} />
             </div>
             <div className="flex justify-center md:justify-end gap-3 pt-4 border-t border-zinc-800">
                <button onClick={handleClearFilters} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-white transition-colors">Počisti</button>
                <button onClick={handleApplyFilters} className="px-6 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-200 transition-colors">Uporabi</button>
             </div>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            <MetricCard
              title="Skupni Profit"
              value={eur(stats.profit)}
              trend={stats.profit >= 0 ? "up" : "down"}
              icon={<TrendingUp className="w-5 h-5" />}
              accentColor="emerald"
              big
            />
            <MetricCard
              title="ROI"
              value={`${(stats.roi * 100).toFixed(2)}%`}
              trend={stats.roi >= 0 ? "up" : "down"}
              subtitle={`Na ${stats.n} stav`}
              icon={<Percent className="w-5 h-5" />}
              accentColor="amber"
            />
            <MetricCard
              title="Win Rate"
              value={`${stats.winRate.toFixed(1)}%`}
              subtitle={`${stats.wins}W - ${stats.losses}L`}
              icon={<Trophy className="w-5 h-5" />}
              accentColor="sky"
            />
            <MetricCard
              title="Povp. Efektivna Kvota"
              value={stats.avgOdds.toFixed(2)}
              subtitle="Tehtano povprečje"
              icon={<Zap className="w-5 h-5" />}
              accentColor="violet"
            />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-6 md:p-8">
                <div className="flex items-center justify-center md:justify-between mb-8">
                    <div className="text-center md:text-left">
                        <h3 className="text-lg font-bold text-white">Rast Profita</h3>
                        <p className="text-sm text-zinc-500">Kumulativni pregled skozi čas</p>
                    </div>
                    <div className="hidden md:flex gap-2">
                         <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Profit
                        </div>
                    </div>
                </div>
                
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.chartData}>
                            <defs>
                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                stroke="#52525b" 
                                fontSize={12} 
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis 
                                stroke="#52525b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                tickFormatter={(val) => `€${val}`}
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                                itemStyle={{ color: '#fff' }}
                                labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                                formatter={(value: number | undefined) => [eur(value ?? 0), "Profit"]}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="profit" 
                                stroke="#10b981" 
                                strokeWidth={2}
                                fillOpacity={1} 
                                fill="url(#colorProfit)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center gap-3 mb-6">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500"><Wallet className="w-5 h-5" /></div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-white">Stanja Stavnic</h3>
                        <p className="text-sm text-zinc-500">Razporeditev kapitala</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {stats.balanceByBook.map((book) => (
                        <div key={book.name} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800 transition-colors">
                            <div className="flex flex-col">
                                <span className="font-bold text-sm text-zinc-300">{book.name}</span>
                                <span className={`text-xs ${book.profit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                    {book.profit >= 0 ? "+" : ""}{eur(book.profit)}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="block font-mono font-medium text-white">{eur(book.balance)}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-6 pt-6 border-t border-zinc-800">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-medium text-zinc-500">Skupna banka</span>
                        <span className="text-2xl font-bold text-white tracking-tight">{eur(stats.balanceByBook.reduce((a, b) => a + b.balance, 0))}</span>
                    </div>
                </div>
            </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <div>
                 <div className="flex items-center justify-center md:justify-between mb-6 px-1">
                    <h3 className="font-bold text-xl text-white">Top Tipsterji</h3>
                 </div>
                 <div className="space-y-3">
                    {statsByTipster.slice(0, 5).map((t, i) => (
                        <div key={t.name} className="group relative overflow-hidden rounded-xl bg-zinc-900/30 border border-zinc-800/50 hover:border-zinc-700 transition-all p-4">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-amber-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-zinc-600 w-4">#{i + 1}</span>
                                    <span className="font-bold text-zinc-200">{t.name}</span>
                                </div>
                                <div className="flex items-center gap-6">
                                     <div className="text-right hidden sm:block">
                                        <div className="text-xs text-zinc-500 uppercase">Yield</div>
                                        <div className={`font-mono font-medium ${(t.roi * 100) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{(t.roi * 100).toFixed(1)}%</div>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <div className="text-xs text-zinc-500 uppercase">Efekt. Kvota</div>
                                        <div className="font-mono font-medium text-amber-400">{t.avgOdds.toFixed(2)}</div>
                                    </div>
                                    <div className="text-right w-24">
                                        <div className="text-xs text-zinc-500 uppercase">Profit</div>
                                        <div className={`font-mono font-bold ${t.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eur(t.profit)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>

            <div>
                 <div className="flex items-center justify-center md:justify-between mb-6 px-1">
                    <h3 className="font-bold text-xl text-white">Po Športih</h3>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    {statsBySport.map((s) => (
                         <div key={s.name} className="rounded-xl bg-zinc-900/30 border border-zinc-800/50 p-4 hover:bg-zinc-800/50 transition-colors text-center">
                            <div className="flex justify-center items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-zinc-500 tracking-wider uppercase">{s.name}</span>
                                {s.profit > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingUp className="w-3 h-3 text-rose-500 rotate-180" />}
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className={`text-lg font-bold ${s.profit >= 0 ? "text-white" : "text-zinc-400"}`}>{eur(s.profit)}</span>
                                <span className="text-xs text-zinc-500">{s.n} stav • Kvota: {s.avgOdds.toFixed(2)}</span>
                            </div>
                         </div>
                    ))}
                 </div>
            </div>
        </section>

        <section className="rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-800/50 flex items-center justify-center gap-3">
                <TableIcon className="w-5 h-5 text-zinc-400" />
                <h3 className="font-bold text-white">Zadnje Stave</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-900/50 text-xs text-zinc-500 uppercase tracking-wider">
                            <th className="p-4 font-semibold text-center">Datum</th>
                            <th className="p-4 font-semibold text-center">Šport</th>
                            <th className="p-4 font-semibold text-center">Tipster</th>
                            <th className="p-4 font-semibold text-center">Stavnica</th>
                            <th className="p-4 font-semibold text-center">Efekt. Kvota</th>
                            <th className="p-4 font-semibold text-center">Vplačilo</th>
                            <th className="p-4 font-semibold text-center">Stanje</th>
                            <th className="p-4 font-semibold text-center">Profit</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-zinc-800/50">
                        {stats.settled.slice().reverse().slice(0, 10).map((row) => {
                            const effOdds = calcEffectiveOdds(row);
                            const stake = hasBack(row) ? row.vplacilo1 : row.vplacilo2;
                            return (
                            <tr key={row.id} className="hover:bg-zinc-800/30 transition-colors group">
                                <td className="p-4 text-zinc-300 font-medium text-center">
                                    {new Date(row.datum).toLocaleDateString("sl-SI")}
                                </td>
                                <td className="p-4 text-zinc-400 text-center">{row.sport}</td>
                                <td className="p-4 text-center">
                                    <span className="px-2 py-1 rounded-md bg-zinc-800 text-xs font-bold text-zinc-300 border border-zinc-700">{row.tipster}</span>
                                </td>
                                <td className="p-4 text-zinc-400 text-xs text-center">{row.stavnica}</td>
                                <td className="p-4 text-center font-mono text-amber-400 font-semibold">{effOdds !== null ? effOdds.toFixed(2) : '-'}</td>
                                <td className="p-4 text-center font-mono text-zinc-300">{eur(stake)}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                        row.wl === 'WIN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                        row.wl === 'LOSS' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                                        'bg-zinc-800 text-zinc-500 border-zinc-700'
                                    }`}>
                                        {row.wl}
                                    </span>
                                </td>
                                <td className={`p-4 text-center font-mono font-bold ${calcProfit(row) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {eur(calcProfit(row))}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
             <div className="p-4 border-t border-zinc-800/50 text-center">
                <button className="text-xs font-bold text-zinc-500 hover:text-white uppercase tracking-widest transition-colors">Prikaži vso zgodovino</button>
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