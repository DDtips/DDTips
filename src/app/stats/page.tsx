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
  Table as TableIcon,
  ChevronDown,
  Layers,
  BarChart3
} from "lucide-react";

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

const BOOK_START: Record<string, number> = {
  SHARP: 2000,
  PINNACLE: 2000,
  BET365: 2000,
  WINAMAX: 1000,
  WWIN: 500,
  "E-STAVE": 500,
  "BET AT HOME": 1000,
};

const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"];
const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"];
const STAVNICE = ["SHARP", "PINNACLE", "BET365", "WINAMAX", "WWIN", "BET AT HOME", "E-STAVE"];

function normBook(x: string) {
  return (x || "").toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
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

function getMode(b: Bet): Mode {
  if (b.mode) return b.mode;
  // fallback za stare vnose
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
  const roi = totalRisk === 0 ? 0 : profit / totalRisk;
  
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
    const normalizedName = normBook(name);
    const p = profitByBook.get(normalizedName) ?? 0;
    balanceByBook.push({ name, start, profit: p, balance: start + p });
  });
  
  profitByBook.forEach((val, key) => {
    const exists = Object.keys(BOOK_START).some(name => normBook(name) === key);
    if (!exists) {
      balanceByBook.push({ name: key, start: 0, profit: val, balance: val });
    }
  });

  balanceByBook.sort((a, b) => b.balance - a.balance);

  return { profit, n, wins, losses, roi, chartData, balanceByBook, winRate, settled };
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

function InputField({ label, value, onChange, type = "text", icon }: { 
  label: string; value: string; onChange: (val: string) => void; type?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center justify-center gap-1 text-[9px] font-bold tracking-widest uppercase text-zinc-500">
        {icon} {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-zinc-950/50 border border-zinc-800 rounded-lg text-zinc-200 text-xs text-center focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, icon }: { 
  label: string; value: string; onChange: (val: string) => void; options: string[]; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center justify-center gap-1 text-[9px] font-bold tracking-widest uppercase text-zinc-500">
        {icon} {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 appearance-none bg-zinc-950/50 border border-zinc-800 rounded-lg text-zinc-200 text-xs text-center focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>
        ))}
      </select>
    </div>
  );
}

function BookCard({ book }: { book: { name: string; start: number; profit: number; balance: number } }) {
  const isPositive = book.profit >= 0;
  const percentChange = book.start > 0 ? ((book.balance - book.start) / book.start * 100) : 0;
  
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800 transition-colors">
      <div className="flex flex-col">
        <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-400">{book.name}</span>
        <span className={`text-[10px] ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
          {isPositive ? "+" : ""}{eur(book.profit)} ({percentChange >= 0 ? "+" : ""}{percentChange.toFixed(1)}%)
        </span>
      </div>
      <span className="font-mono text-sm font-medium text-white">{eur(book.balance)}</span>
    </div>
  );
}

// Piramidna kartica za profit
function PyramidProfitCard({ 
  title, 
  profit, 
  subtitle,
  accentColor = "emerald",
  size = "normal"
}: { 
  title: string; 
  profit: number; 
  subtitle?: string;
  accentColor?: "emerald" | "sky" | "violet";
  size?: "large" | "normal" | "small";
}) {
  const isPositive = profit >= 0;
  const gradients = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    sky: "from-sky-500/20 to-sky-500/5 border-sky-500/30",
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/30",
  };
  
  const sizes = {
    large: "py-6 px-8",
    normal: "py-4 px-6",
    small: "py-3 px-4",
  };

  const textSizes = {
    large: "text-3xl",
    normal: "text-xl",
    small: "text-lg",
  };

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradients[accentColor]} border backdrop-blur-md text-center ${sizes[size]}`}>
      <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 block mb-2">{title}</span>
      <span className={`${textSizes[size]} font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
        {eur(profit)}
      </span>
      {subtitle && <span className="text-[10px] text-zinc-500 block mt-1">{subtitle}</span>}
    </div>
  );
}

// Kartica za tipster/šport breakdown
function BreakdownCard({ 
  name, 
  profit, 
  wins, 
  losses, 
  winRate,
  roi
}: { 
  name: string; 
  profit: number; 
  wins: number;
  losses: number;
  winRate: number;
  roi: number;
}) {
  const isPositive = profit >= 0;
  
  return (
    <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-3 hover:bg-zinc-800/50 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-zinc-300">{name}</span>
        <span className={`text-sm font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
          {eur(profit)}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>{wins}W / {losses}L</span>
        <span>WR: {winRate.toFixed(0)}%</span>
        <span className={roi >= 0 ? "text-emerald-500" : "text-rose-500"}>ROI: {(roi * 100).toFixed(1)}%</span>
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

  const [appliedFilters, setAppliedFilters] = useState({
    sport: "ALL", tipster: "ALL", stavnica: "ALL", cas: "ALL" as "ALL" | Cas,
    fromDate: "", toDate: "",
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
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: true });
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
      return true;
    });
  }, [rows, appliedFilters]);

  // Razdeli po mode
  const bettingRows = useMemo(() => filteredRows.filter(r => getMode(r) === "BET"), [filteredRows]);
  const tradingRows = useMemo(() => filteredRows.filter(r => getMode(r) === "TRADING"), [filteredRows]);

  const totalStats = useMemo(() => buildStats(filteredRows), [filteredRows]);
  const bettingStats = useMemo(() => buildStats(bettingRows), [bettingRows]);
  const tradingStats = useMemo(() => buildStats(tradingRows), [tradingRows]);

  // Tipsterji za betting in trading ločeno
  const bettingByTipster = useMemo(() => buildStatsByCategory(bettingRows, 'tipster'), [bettingRows]);
  const tradingByTipster = useMemo(() => buildStatsByCategory(tradingRows, 'tipster'), [tradingRows]);

  // Športi za betting in trading ločeno
  const bettingBySport = useMemo(() => buildStatsByCategory(bettingRows, 'sport'), [bettingRows]);
  const tradingBySport = useMemo(() => buildStatsByCategory(tradingRows, 'sport'), [tradingRows]);

  const handleApplyFilters = () => {
    setAppliedFilters({ sport, tipster, stavnica, cas, fromDate, toDate });
    setFiltersOpen(false);
  };

  const handleClearFilters = () => {
    setSport("ALL"); setTipster("ALL"); setStavnica("ALL"); setCas("ALL");
    setFromDate(""); setToDate("");
    setAppliedFilters({ sport: "ALL", tipster: "ALL", stavnica: "ALL", cas: "ALL", fromDate: "", toDate: "" });
  };

  const hasActiveFilters = appliedFilters.sport !== "ALL" || appliedFilters.tipster !== "ALL" || 
    appliedFilters.stavnica !== "ALL" || appliedFilters.cas !== "ALL" || 
    appliedFilters.fromDate !== "" || appliedFilters.toDate !== "";

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

      <div className="relative max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-10">
        
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">Live Dashboard</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1">
              Statistika <span className="text-zinc-600">Performance</span>
            </h1>
            <p className="text-zinc-400 text-sm font-medium">Pregled donosnosti in analitika stav</p>
          </div>
          
          <div className="flex items-center justify-center md:justify-end gap-2">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-200 ${filtersOpen ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'}`}
            >
              <Filter className="w-3 h-3" />
              <span className="text-xs font-semibold">Filtri</span>
              {hasActiveFilters && <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>}
            </button>
            <button
              onClick={loadRows}
              className="group p-2.5 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all duration-200 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)]"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
            </button>
          </div>
        </header>

        {/* Filter Panel */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${filtersOpen ? 'max-h-[400px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
              <InputField label="Od" value={fromDate} onChange={setFromDate} type="date" icon={<Calendar className="w-2 h-2" />} />
              <InputField label="Do" value={toDate} onChange={setToDate} type="date" icon={<Calendar className="w-2 h-2" />} />
              <SelectField label="Šport" value={sport} onChange={setSport} options={["ALL", ...SPORTI]} icon={<Target className="w-2 h-2" />} />
              <SelectField label="Tipster" value={tipster} onChange={setTipster} options={["ALL", ...TIPSTERJI]} icon={<Users className="w-2 h-2" />} />
              <SelectField label="Stavnica" value={stavnica} onChange={setStavnica} options={["ALL", ...STAVNICE]} icon={<Building2 className="w-2 h-2" />} />
              <SelectField label="Čas" value={cas} onChange={(v: string) => setCas(v as "ALL" | Cas)} options={["ALL", "PREMATCH", "LIVE"]} icon={<Clock className="w-2 h-2" />} />
            </div>
            <div className="flex justify-center md:justify-end gap-2 pt-3 border-t border-zinc-800">
              <button onClick={handleClearFilters} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white transition-colors">Počisti</button>
              <button onClick={handleApplyFilters} className="px-4 py-1.5 bg-white text-black text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-200 transition-colors">Uporabi</button>
            </div>
          </div>
        </div>

        {/* ============================================= */}
        {/* PIRAMIDNA STRUKTURA - SKUPNA STATISTIKA */}
        {/* ============================================= */}
        <section className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Layers className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold text-white">Skupna Statistika</h2>
          </div>

          {/* VRHNЈА KARTICA - SKUPNI PROFIT */}
          <div className="flex justify-center mb-4">
            <div className="w-full max-w-md">
              <PyramidProfitCard 
                title="SKUPNI PROFIT" 
                profit={totalStats.profit} 
                subtitle={`${totalStats.n} stav • ROI: ${(totalStats.roi * 100).toFixed(1)}% • WR: ${totalStats.winRate.toFixed(0)}%`}
                accentColor="emerald"
                size="large"
              />
            </div>
          </div>

          {/* POVEZOVALNE ČRTE (vizualno) */}
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-8">
              <div className="w-24 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-sky-500/50"></div>
              <ChevronDown className="w-5 h-5 text-zinc-600" />
              <div className="w-24 h-px bg-gradient-to-l from-transparent via-violet-500/50 to-violet-500/50"></div>
            </div>
          </div>

          {/* DRUGI NIVO - BETTING & TRADING */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* BETTING */}
            <div className="space-y-3">
              <PyramidProfitCard 
                title="BETTING" 
                profit={bettingStats.profit} 
                subtitle={`${bettingStats.n} stav • ROI: ${(bettingStats.roi * 100).toFixed(1)}%`}
                accentColor="sky"
                size="normal"
              />
              
              {/* Tipsterji za Betting */}
              <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/50 p-4">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Users className="w-3 h-3 text-sky-400" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Tipsterji (Betting)</span>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {bettingByTipster.filter(t => t.n > 0).map(t => (
                    <BreakdownCard key={t.name} name={t.name} profit={t.profit} wins={t.wins} losses={t.losses} winRate={t.winRate} roi={t.roi} />
                  ))}
                  {bettingByTipster.filter(t => t.n > 0).length === 0 && (
                    <div className="text-center text-zinc-600 text-xs py-4">Ni podatkov</div>
                  )}
                </div>
              </div>

              {/* Športi za Betting */}
              <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/50 p-4">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Target className="w-3 h-3 text-sky-400" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Športi (Betting)</span>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {bettingBySport.filter(s => s.n > 0).map(s => (
                    <BreakdownCard key={s.name} name={s.name} profit={s.profit} wins={s.wins} losses={s.losses} winRate={s.winRate} roi={s.roi} />
                  ))}
                  {bettingBySport.filter(s => s.n > 0).length === 0 && (
                    <div className="text-center text-zinc-600 text-xs py-4">Ni podatkov</div>
                  )}
                </div>
              </div>
            </div>

            {/* TRADING */}
            <div className="space-y-3">
              <PyramidProfitCard 
                title="TRADING" 
                profit={tradingStats.profit} 
                subtitle={`${tradingStats.n} stav • ROI: ${(tradingStats.roi * 100).toFixed(1)}%`}
                accentColor="violet"
                size="normal"
              />
              
              {/* Tipsterji za Trading */}
              <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/50 p-4">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Users className="w-3 h-3 text-violet-400" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Tipsterji (Trading)</span>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {tradingByTipster.filter(t => t.n > 0).map(t => (
                    <BreakdownCard key={t.name} name={t.name} profit={t.profit} wins={t.wins} losses={t.losses} winRate={t.winRate} roi={t.roi} />
                  ))}
                  {tradingByTipster.filter(t => t.n > 0).length === 0 && (
                    <div className="text-center text-zinc-600 text-xs py-4">Ni podatkov</div>
                  )}
                </div>
              </div>

              {/* Športi za Trading */}
              <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/50 p-4">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Target className="w-3 h-3 text-violet-400" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Športi (Trading)</span>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {tradingBySport.filter(s => s.n > 0).map(s => (
                    <BreakdownCard key={s.name} name={s.name} profit={s.profit} wins={s.wins} losses={s.losses} winRate={s.winRate} roi={s.roi} />
                  ))}
                  {tradingBySport.filter(s => s.n > 0).length === 0 && (
                    <div className="text-center text-zinc-600 text-xs py-4">Ni podatkov</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================= */}
        {/* GRAF + STAVNICE */}
        {/* ============================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-5">
            <div className="flex items-center justify-center mb-4">
              <div className="text-center">
                <h3 className="text-sm font-bold text-white">Rast Profita</h3>
                <p className="text-xs text-zinc-500">Kumulativni pregled skozi čas</p>
              </div>
            </div>
            
            <div className="h-[240px] w-full">
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
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    formatter={(value: number | undefined) => [eur(value ?? 0), "Profit"]}
                  />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-5 flex flex-col">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500"><Wallet className="w-4 h-4" /></div>
              <div className="text-center">
                <h3 className="text-sm font-bold text-white">Stanja Stavnic</h3>
                <p className="text-xs text-zinc-500">Razporeditev kapitala</p>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {totalStats.balanceByBook.map((book) => (
                <BookCard key={book.name} book={book} />
              ))}
            </div>
            
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-zinc-500">Skupna banka</span>
                <span className="text-lg font-bold text-white">{eur(totalStats.balanceByBook.reduce((a, b) => a + b.balance, 0))}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================= */}
        {/* ZADNJE STAVE */}
        {/* ============================================= */}
        <section className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-800/50 flex items-center justify-center gap-2">
            <TableIcon className="w-4 h-4 text-zinc-400" />
            <h3 className="font-bold text-sm text-white">Zadnje Stave</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-900/50 text-[10px] text-zinc-500 uppercase tracking-wider">
                  <th className="p-3 font-semibold text-center">Datum</th>
                  <th className="p-3 font-semibold text-center">Mode</th>
                  <th className="p-3 font-semibold text-center">Šport</th>
                  <th className="p-3 font-semibold text-center">Tipster</th>
                  <th className="p-3 font-semibold text-center">Stavnica</th>
                  <th className="p-3 font-semibold text-center">Stanje</th>
                  <th className="p-3 font-semibold text-center">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {totalStats.settled.slice().reverse().slice(0, 10).map((row) => {
                  const mode = getMode(row);
                  return (
                    <tr key={row.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="p-3 text-zinc-300 text-center">{new Date(row.datum).toLocaleDateString("sl-SI")}</td>
                      <td className="p-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          mode === 'TRADING' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        }`}>
                          {mode}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-400 text-center">{row.sport}</td>
                      <td className="p-3 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-bold text-zinc-300 border border-zinc-700">{row.tipster}</span>
                      </td>
                      <td className="p-3 text-zinc-400 text-center">{row.stavnica}</td>
                      <td className="p-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          row.wl === 'WIN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                          row.wl === 'LOSS' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                          'bg-zinc-800 text-zinc-500 border-zinc-700'
                        }`}>
                          {row.wl}
                        </span>
                      </td>
                      <td className={`p-3 text-center font-mono font-bold ${calcProfit(row) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {eur(calcProfit(row))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-8 pt-6 border-t border-zinc-900 text-center flex flex-col md:flex-row justify-between items-center text-zinc-600 text-xs gap-2">
          <p>© 2024 DDTips Analytics. Vse pravice pridržane.</p>
          <p className="font-mono">Last updated: {new Date().toLocaleTimeString()}</p>
        </footer>
      </div>
    </main>
  );
}