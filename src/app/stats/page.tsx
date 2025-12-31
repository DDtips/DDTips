"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Trophy, 
  Calendar, 
  Filter, 
  BarChart3, 
  Users, 
  Building2, 
  Clock, 
  TrendingDown,
  Activity,
  Percent,
  Zap,
  RefreshCw,
  X
} from "lucide-react";

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
};

const CAPITAL_DAVID = 3500;
const CAPITAL_DEJAN = 3500;
const CAPITAL_TOTAL = CAPITAL_DAVID + CAPITAL_DEJAN;

const BOOK_START: Record<string, number> = {
  SHARP: 2000,
  PINNACLE: 2000,
  BET365: 2000,
  WINAMAX: 1000,
};

const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"];
const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"];
const STAVNICE = ["SHARP", "PINNACLE", "BET365", "WINAMAX", "WWIN", "BET AT HOME", "E - STAVE"];

function normBook(x: string) {
  return (x || "").toUpperCase().replace(/\s+/g, "");
}

function eur(n: number) {
  return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR" });
}

function hasLay(b: Bet) {
  return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0;
}

function calcProfit(b: Bet): number {
  const kom = b.komisija || 0;
  if (b.wl !== "WIN" && b.wl !== "LOSS") return 0;

  if (!hasLay(b)) {
    if (b.wl === "WIN") return b.vplacilo1 * (b.kvota1 - 1) - kom;
    if (b.wl === "LOSS") return -b.vplacilo1 - kom;
    return 0;
  }

  const backStake = b.vplacilo1;
  const backOdds = b.kvota1;
  const layStake = b.vplacilo2;
  const layOdds = b.lay_kvota;
  const liability = (layOdds - 1) * layStake;

  if (b.wl === "WIN") return backStake * (backOdds - 1) - liability - kom;
  if (b.wl === "LOSS") return -backStake + layStake - kom;

  return 0;
}

function buildStats(rows: Bet[]) {
  const settled = rows.filter((r) => r.wl === "WIN" || r.wl === "LOSS");

  const n = settled.length;
  const wins = settled.filter((r) => r.wl === "WIN").length;
  const losses = settled.filter((r) => r.wl === "LOSS").length;

  const profit = settled.reduce((acc, r) => acc + calcProfit(r), 0);

  const avgOdds =
    n === 0 ? 0 : settled.reduce((acc, r) => acc + (Number(r.kvota1) || 0), 0) / n;

  const roi = CAPITAL_TOTAL === 0 ? 0 : profit / CAPITAL_TOTAL;
  const bankroll = CAPITAL_TOTAL + profit;
  const winRate = n > 0 ? (wins / n) * 100 : 0;

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

  profitByBook.forEach((p, name) => {
    if (!(name in BOOK_START)) balanceByBook.push({ name, start: 0, profit: p, balance: p });
  });

  balanceByBook.sort((a, b) => b.balance - a.balance);

  return { profit, n, wins, losses, avgOdds, roi, bankroll, balanceByBook, winRate };
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

// Metric Card komponenta
function MetricCard({ 
  title, 
  value, 
  subtitle,
  trend,
  icon,
  accentColor = "emerald"
}: { 
  title: string; 
  value: string; 
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  accentColor?: "emerald" | "amber" | "rose" | "sky" | "violet";
}) {
  const colors = {
    emerald: "from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30",
    amber: "from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/30",
    rose: "from-rose-500/20 via-rose-500/5 to-transparent border-rose-500/30",
    sky: "from-sky-500/20 via-sky-500/5 to-transparent border-sky-500/30",
    violet: "from-violet-500/20 via-violet-500/5 to-transparent border-violet-500/30",
  };

  const iconColors = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    sky: "text-sky-400",
    violet: "text-violet-400",
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors[accentColor]} border backdrop-blur-sm p-5 transition-all duration-500 hover:scale-[1.02] group`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">{title}</span>
          {icon && <div className={`${iconColors[accentColor]} opacity-70`}>{icon}</div>}
        </div>
        
        <div className="flex items-end gap-2">
          <span className={`text-2xl font-light tracking-tight ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-white"}`}>
            {value}
          </span>
          {trend && trend !== "neutral" && (
            <span className={`text-sm font-medium pb-1 ${trend === "up" ? "text-emerald-400" : "text-rose-400"}`}>
              {trend === "up" ? "↑" : "↓"}
            </span>
          )}
        </div>
        
        {subtitle && (
          <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// Stat Card komponenta za kategorije
function StatCard({ 
  name, 
  profit, 
  n, 
  wins, 
  losses, 
  avgOdds, 
  roi,
  winRate,
  accentColor = "emerald"
}: { 
  name: string;
  profit: number;
  n: number;
  wins: number;
  losses: number;
  avgOdds: number;
  roi: number;
  winRate: number;
  accentColor?: "emerald" | "amber" | "sky" | "violet" | "rose";
}) {
  const colors = {
    emerald: "text-emerald-400 border-emerald-500/30",
    amber: "text-amber-400 border-amber-500/30",
    sky: "text-sky-400 border-sky-500/30",
    violet: "text-violet-400 border-violet-500/30",
    rose: "text-rose-400 border-rose-500/30",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-zinc-900/60 border border-zinc-800 p-5 transition-all duration-300 hover:bg-zinc-900/80 hover:border-zinc-700">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/[0.02] to-transparent" />
      
      <div className="relative z-10">
        <div className={`text-lg font-bold mb-4 ${colors[accentColor].split(' ')[0]}`}>{name}</div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Profit</span>
            <span className={`text-sm font-semibold tabular-nums ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {eur(profit)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Stave</span>
            <span className="text-sm font-medium text-white tabular-nums">{n}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">W / L</span>
            <span className="text-sm font-medium tabular-nums">
              <span className="text-emerald-400">{wins}</span>
              <span className="text-zinc-600 mx-1">/</span>
              <span className="text-rose-400">{losses}</span>
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Win Rate</span>
            <span className="text-sm font-medium text-sky-400 tabular-nums">{winRate.toFixed(1)}%</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Avg Kvota</span>
            <span className="text-sm font-medium text-amber-400 tabular-nums">{avgOdds.toFixed(2)}</span>
          </div>
          
          <div className="pt-2 mt-2 border-t border-zinc-800">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">ROI</span>
              <span className={`text-sm font-bold tabular-nums ${roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(roi * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Input Field komponenta
function InputField({ 
  label, 
  value, 
  onChange, 
  type = "text",
  icon
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
        {icon}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-zinc-800/80 border border-zinc-700/50 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-800 transition-all duration-300"
      />
    </div>
  );
}

// Select Field komponenta
function SelectField({ 
  label, 
  value, 
  onChange, 
  options,
  icon
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  options: string[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
        {icon}
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-zinc-800/80 border border-zinc-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-800 transition-all duration-300 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Filter states
  const [sport, setSport] = useState("ALL");
  const [tipster, setTipster] = useState("ALL");
  const [stavnica, setStavnica] = useState("ALL");
  const [cas, setCas] = useState<"ALL" | Cas>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [oddsFilter, setOddsFilter] = useState<"ALL" | "OVER" | "UNDER">("ALL");
  const [oddsValue, setOddsValue] = useState("2");

  // Applied filters
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

  const [filtersOpen, setFiltersOpen] = useState(true);

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
        const threshold = parseFloat(appliedFilters.oddsValue);
        if (appliedFilters.oddsFilter === "OVER" && r.kvota1 <= threshold) return false;
        if (appliedFilters.oddsFilter === "UNDER" && r.kvota1 >= threshold) return false;
      }
      
      return true;
    });
  }, [rows, appliedFilters]);

  const filtered = useMemo(() => buildStats(filteredRows), [filteredRows]);

  const statsByTipster = useMemo(() => buildStatsByCategory(filteredRows, 'tipster'), [filteredRows]);
  const statsBySport = useMemo(() => buildStatsByCategory(filteredRows, 'sport'), [filteredRows]);
  const statsByCas = useMemo(() => buildStatsByCategory(filteredRows, 'cas_stave'), [filteredRows]);

  const handleApplyFilters = () => {
    setAppliedFilters({
      sport,
      tipster,
      stavnica,
      cas,
      fromDate,
      toDate,
      oddsFilter,
      oddsValue,
    });
  };

  const handleClearFilters = () => {
    setSport("ALL");
    setTipster("ALL");
    setStavnica("ALL");
    setCas("ALL");
    setFromDate("");
    setToDate("");
    setOddsFilter("ALL");
    setOddsValue("2");
    setAppliedFilters({
      sport: "ALL",
      tipster: "ALL",
      stavnica: "ALL",
      cas: "ALL",
      fromDate: "",
      toDate: "",
      oddsFilter: "ALL",
      oddsValue: "2",
    });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.sport !== "ALL") count++;
    if (appliedFilters.tipster !== "ALL") count++;
    if (appliedFilters.stavnica !== "ALL") count++;
    if (appliedFilters.cas !== "ALL") count++;
    if (appliedFilters.fromDate) count++;
    if (appliedFilters.toDate) count++;
    if (appliedFilters.oddsFilter !== "ALL") count++;
    return count;
  }, [appliedFilters]);

  if (loading && rows.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-zinc-500 text-sm tracking-widest uppercase">Nalagam...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white antialiased">
      {/* Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black" />
      <div className="fixed inset-0 opacity-30" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")" }} />
      
      <div className="relative max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white mb-1">Statistika</h1>
            <p className="text-sm text-zinc-500">Analiza stav in rezultatov</p>
          </div>
          <button
            onClick={loadRows}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-600 transition-all duration-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="text-sm font-medium">Osveži</span>
          </button>
        </header>

        {msg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {msg}
          </div>
        )}

        {/* Filtri */}
        <section className="mb-8">
          <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-sm overflow-hidden">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-500/20 rounded-lg">
                  <Filter className="w-4 h-4 text-sky-400" />
                </div>
                <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-zinc-300">Filtri</h2>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500/20 text-emerald-400 rounded-full">
                    {activeFilterCount} aktivnih
                  </span>
                )}
              </div>
              <div className={`transform transition-transform ${filtersOpen ? 'rotate-180' : ''}`}>
                <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            
            {filtersOpen && (
              <div className="px-6 pb-6 border-t border-zinc-800 bg-zinc-900/50">
                <div className="pt-5 grid grid-cols-4 gap-4 mb-4">
                  <InputField
                    label="Od datuma"
                    value={fromDate}
                    onChange={setFromDate}
                    type="date"
                    icon={<Calendar className="w-3 h-3" />}
                  />
                  <InputField
                    label="Do datuma"
                    value={toDate}
                    onChange={setToDate}
                    type="date"
                    icon={<Calendar className="w-3 h-3" />}
                  />
                  <SelectField
                    label="Šport"
                    value={sport}
                    onChange={setSport}
                    options={["ALL", ...SPORTI]}
                    icon={<Target className="w-3 h-3" />}
                  />
                  <SelectField
                    label="Tipster"
                    value={tipster}
                    onChange={setTipster}
                    options={["ALL", ...TIPSTERJI]}
                    icon={<Users className="w-3 h-3" />}
                  />
                  <SelectField
                    label="Stavnica"
                    value={stavnica}
                    onChange={setStavnica}
                    options={["ALL", ...STAVNICE]}
                    icon={<Building2 className="w-3 h-3" />}
                  />
                  <SelectField
                    label="Prematch / Live"
                    value={cas}
                    onChange={(v) => setCas(v as "ALL" | Cas)}
                    options={["ALL", "PREMATCH", "LIVE"]}
                    icon={<Clock className="w-3 h-3" />}
                  />
                  <SelectField
                    label="Kvota filter"
                    value={oddsFilter}
                    onChange={(v) => setOddsFilter(v as "ALL" | "OVER" | "UNDER")}
                    options={["ALL", "OVER", "UNDER"]}
                    icon={<TrendingUp className="w-3 h-3" />}
                  />
                  <InputField
                    label="Vrednost kvote"
                    value={oddsValue}
                    onChange={setOddsValue}
                    type="number"
                    icon={<Zap className="w-3 h-3" />}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleApplyFilters}
                    className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-500 transition-all duration-300 shadow-lg shadow-emerald-600/20"
                  >
                    Potrdi filtre
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 border border-zinc-700/50 text-zinc-300 text-sm font-medium rounded-xl hover:bg-zinc-700 hover:text-white transition-all duration-300"
                  >
                    <X className="w-4 h-4" />
                    Počisti
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Glavne metrike */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-zinc-400" />
            <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-zinc-300">Pregled</h2>
            <span className="text-xs text-zinc-600">• {filtered.n} stav</span>
          </div>
          
          <div className="grid grid-cols-6 gap-4">
            <MetricCard
              title="Profit"
              value={eur(filtered.profit)}
              trend={filtered.profit >= 0 ? "up" : "down"}
              icon={<TrendingUp className="w-4 h-4" />}
              accentColor="emerald"
            />
            <MetricCard
              title="ROI"
              value={`${(filtered.roi * 100).toFixed(2)}%`}
              trend={filtered.roi >= 0 ? "up" : "down"}
              icon={<Percent className="w-4 h-4" />}
              accentColor="amber"
            />
            <MetricCard
              title="Win Rate"
              value={`${filtered.winRate.toFixed(1)}%`}
              subtitle={`${filtered.wins}W / ${filtered.losses}L`}
              icon={<Trophy className="w-4 h-4" />}
              accentColor="sky"
            />
            <MetricCard
              title="Stave"
              value={String(filtered.n)}
              icon={<Activity className="w-4 h-4" />}
              accentColor="violet"
            />
            <MetricCard
              title="Zmage"
              value={String(filtered.wins)}
              icon={<Trophy className="w-4 h-4" />}
              accentColor="emerald"
            />
            <MetricCard
              title="Avg Kvota"
              value={filtered.avgOdds ? filtered.avgOdds.toFixed(2) : "-"}
              icon={<Zap className="w-4 h-4" />}
              accentColor="amber"
            />
          </div>
        </section>

        {/* Statistika po tipsterjih */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-zinc-300">Po tipsterjih</h2>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            {statsByTipster.map((stat) => (
              <StatCard
                key={stat.name}
                name={stat.name}
                profit={stat.profit}
                n={stat.n}
                wins={stat.wins}
                losses={stat.losses}
                avgOdds={stat.avgOdds}
                roi={stat.roi}
                winRate={stat.winRate}
                accentColor="amber"
              />
            ))}
          </div>
        </section>

        {/* Statistika po športih */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-zinc-300">Po športih</h2>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            {statsBySport.map((stat) => (
              <StatCard
                key={stat.name}
                name={stat.name}
                profit={stat.profit}
                n={stat.n}
                wins={stat.wins}
                losses={stat.losses}
                avgOdds={stat.avgOdds}
                roi={stat.roi}
                winRate={stat.winRate}
                accentColor="sky"
              />
            ))}
          </div>
        </section>

        {/* Statistika po času */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-zinc-300">Prematch vs Live</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {statsByCas.map((stat) => (
              <StatCard
                key={stat.name}
                name={stat.name}
                profit={stat.profit}
                n={stat.n}
                wins={stat.wins}
                losses={stat.losses}
                avgOdds={stat.avgOdds}
                roi={stat.roi}
                winRate={stat.winRate}
                accentColor="violet"
              />
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-zinc-800/50">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>DDTips Match Analysis & Picks</span>
            <span>Zadnja posodobitev: {new Date().toLocaleDateString("sl-SI")}</span>
          </div>
        </footer>
      </div>
    </main>
  );
}