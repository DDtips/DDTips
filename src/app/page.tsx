"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Trophy, 
  BarChart3, 
  Building2, 
  Users, 
  Activity,
  Zap,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Wallet
} from "lucide-react";

type WL = "OPEN" | "WIN" | "LOSS" | "VOID";

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
  cas_stave: string;
  tipster: string;
  stavnica: string;
};

const CAPITAL_TOTAL = 9000;

const BOOK_START: Record<string, number> = {
  SHARP: 2000,
  PINNACLE: 2000,
  BET365: 2000,
  WINAMAX: 1000,
  WWIN: 500,
  "E-STAVE": 500,
  "BET AT HOME": 1000,
};

const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"];
const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"];

function normBook(x: string) {
  return (x || "").toUpperCase().replace(/\s+/g, "");
}

function eur(n: number) {
  return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR" });
}

function monthKey(d: string) {
  return d.slice(0, 7);
}

function hasLay(b: Bet) {
  return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0;
}

function hasBack(b: Bet) {
  return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0;
}

// Nova funkcija za izračun efektivne kvote
function calcEffectiveOdds(b: Bet): number | null {
  const hasBackBet = hasBack(b);
  const hasLayBet = hasLay(b);
  
  // Samo back kvota
  if (hasBackBet && !hasLayBet) {
    return b.kvota1;
  }
  
  // Samo lay kvota - efektivna kvota = layLiability / layStake + 1
  // Primer: lay 1.20 za 100€ -> zmagaš 100€, zgubiš 20€ -> efektivna = 100/20 + 1 = 6
  if (!hasBackBet && hasLayBet) {
    const layLiability = (b.lay_kvota - 1) * b.vplacilo2;
    if (layLiability <= 0) return null;
    return b.vplacilo2 / layLiability + 1;
  }
  
  // Oboje - back + lay (trading)
  if (hasBackBet && hasLayBet) {
    const layLiability = (b.lay_kvota - 1) * b.vplacilo2;
    const netStake = b.vplacilo1 - b.vplacilo2; // koliko smo dejansko vložili
    const potentialWin = (b.kvota1 - 1) * b.vplacilo1 - layLiability;
    
    if (netStake <= 0) {
      // Že imamo profit ne glede na izid (arb)
      return null;
    }
    
    return potentialWin / netStake + 1;
  }
  
  return null;
}

function calcProfit(b: Bet): number {
  const kom = b.komisija || 0;
  if (b.wl !== "WIN" && b.wl !== "LOSS") return 0;

  const hasBackBet = hasBack(b);
  const hasLayBet = hasLay(b);

  // Samo lay (brez back)
  if (!hasBackBet && hasLayBet) {
    const layLiability = (b.lay_kvota - 1) * b.vplacilo2;
    if (b.wl === "WIN") {
      // Pri SAMO lay: WIN pomeni da je selection IZGUBIL (mi smo layali)
      // Torej mi dobimo layStake
      return b.vplacilo2 - kom;
    } else {
      // LOSS pomeni da je selection ZMAGAL, mi zgubimo liability
      return -layLiability - kom;
    }
  }

  // Samo back (brez lay)
  if (hasBackBet && !hasLayBet) {
    if (b.wl === "WIN") return b.vplacilo1 * (b.kvota1 - 1) - kom;
    if (b.wl === "LOSS") return -b.vplacilo1 - kom;
    return 0;
  }

  // Back + Lay (trading)
  if (hasBackBet && hasLayBet) {
    const layLiability = (b.lay_kvota - 1) * b.vplacilo2;
    
    if (b.wl === "WIN") {
      // Back zadel, lay zgubil
      return b.vplacilo1 * (b.kvota1 - 1) - layLiability - kom;
    } else {
      // Back zgubil, lay zadel
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

  // Povprečna efektivna kvota
  const effectiveOdds = settled.map(r => calcEffectiveOdds(r)).filter(o => o !== null) as number[];
  const avgOdds = effectiveOdds.length > 0 
    ? effectiveOdds.reduce((acc, o) => acc + o, 0) / effectiveOdds.length 
    : 0;

  const bankroll = CAPITAL_TOTAL + profit;

  const totalStakes = settled.reduce((acc, r) => {
    if (hasBack(r)) return acc + r.vplacilo1;
    if (hasLay(r)) return acc + r.vplacilo2;
    return acc;
  }, 0);
  const roiPercent = totalStakes === 0 ? 0 : (profit / totalStakes) * 100;

  const donosNaKapital = ((bankroll - CAPITAL_TOTAL) / CAPITAL_TOTAL) * 100;

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

  const profitBySport = new Map<string, number>();
  SPORTI.forEach(sport => profitBySport.set(sport, 0));
  settled.forEach((r) => {
    const key = r.sport || "OSTALO";
    profitBySport.set(key, (profitBySport.get(key) ?? 0) + calcProfit(r));
  });

  const profitByTipster = new Map<string, number>();
  TIPSTERJI.forEach(tipster => profitByTipster.set(tipster, 0));
  settled.forEach((r) => {
    const key = r.tipster || "NEZNANO";
    profitByTipster.set(key, (profitByTipster.get(key) ?? 0) + calcProfit(r));
  });

  const prematch = settled.filter(r => r.cas_stave === "PREMATCH");
  const live = settled.filter(r => r.cas_stave === "LIVE");
  
  const profitPrematch = prematch.reduce((acc, r) => acc + calcProfit(r), 0);
  const profitLive = live.reduce((acc, r) => acc + calcProfit(r), 0);

  return { 
    profit, 
    n, 
    wins, 
    losses, 
    avgOdds, 
    bankroll, 
    balanceByBook,
    profitBySport,
    profitByTipster,
    profitPrematch,
    profitLive,
    prematchCount: prematch.length,
    liveCount: live.length,
    roiPercent, 
    donosNaKapital
  };
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

function DataTable({ 
  title, 
  data, 
  icon
}: { 
  title: string; 
  data: { label: string; value: string; profit: number }[];
  icon?: React.ReactNode;
}) {
  const maxProfit = Math.max(...data.map(d => Math.abs(d.profit)));
  
  return (
    <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-center gap-3">
        {icon && <div className="text-zinc-400">{icon}</div>}
        <h3 className="text-sm font-bold tracking-widest uppercase text-zinc-300">{title}</h3>
      </div>
      
      <div className="p-4 space-y-1">
        {data.map((item, idx) => {
          const barWidth = maxProfit > 0 ? (Math.abs(item.profit) / maxProfit) * 100 : 0;
          const isPositive = item.profit >= 0;
          
          return (
            <div 
              key={idx} 
              className="relative flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors group"
            >
              <div 
                className={`absolute left-0 top-0 bottom-0 rounded-xl transition-all duration-500 ${isPositive ? "bg-emerald-500/10" : "bg-rose-500/10"}`}
                style={{ width: `${barWidth}%` }}
              />
              
              <span className="relative z-10 text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                {item.label}
              </span>
              <span className={`relative z-10 text-sm font-semibold tabular-nums ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookCard({ book }: { book: { name: string; start: number; profit: number; balance: number } }) {
  const isPositive = book.profit >= 0;
  const percentChange = book.start > 0 ? ((book.balance - book.start) / book.start * 100) : 0;
  
  return (
    <div className="group relative overflow-hidden rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-4 transition-all duration-300 hover:bg-zinc-800 hover:border-zinc-700">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-xs font-bold tracking-widest uppercase text-zinc-500">{book.name}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPositive ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
            {isPositive ? "+" : ""}{percentChange.toFixed(1)}%
          </span>
        </div>
        
        <div className="mb-2">
          <span className={`text-xl font-bold tracking-tight ${isPositive ? "text-white" : "text-zinc-400"}`}>
            {eur(book.balance)}
          </span>
        </div>
        
        <div className="text-xs text-zinc-500">
          <span className={`font-semibold ${isPositive ? "text-emerald-400/80" : "text-rose-400/80"}`}>
            {isPositive ? "+" : ""}{eur(book.profit)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
    const { data, error } = await supabase
      .from("bets")
      .select("*")
      .order("datum", { ascending: true });
    setLoading(false);
    if (error) return;
    setRows((data ?? []) as Bet[]);
  }

  const stats = useMemo(() => buildStats(rows), [rows]);

  const chartMonthly = useMemo(() => {
    const settled = rows.filter((r) => r.wl === "WIN" || r.wl === "LOSS");
    const map = new Map<string, number>();
    let cumulative = 0;
    
    settled.forEach((r) => {
      const key = monthKey(r.datum);
      map.set(key, (map.get(key) ?? 0) + calcProfit(r));
    });

    const arr = Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([m, profit]) => {
        cumulative += profit;
        const [year, month] = m.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        const monthName = date.toLocaleDateString('sl-SI', { month: 'short', year: '2-digit' });
        return { month: m, monthName, profit, cumulative };
      });

    return arr;
  }, [rows]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-zinc-500 text-xs font-bold tracking-widest uppercase animate-pulse">Loading Data</span>
        </div>
      </div>
    );
  }

  const sportData = SPORTI.map(sport => ({
    label: sport,
    value: eur(stats.profitBySport.get(sport) ?? 0),
    profit: stats.profitBySport.get(sport) ?? 0
  })).sort((a, b) => b.profit - a.profit);

  const tipsterData = TIPSTERJI.map(tipster => ({
    label: tipster,
    value: eur(stats.profitByTipster.get(tipster) ?? 0),
    profit: stats.profitByTipster.get(tipster) ?? 0
  })).sort((a, b) => b.profit - a.profit);

  const timingData = [
    {
      label: `Prematch (${stats.prematchCount})`,
      value: eur(stats.profitPrematch),
      profit: stats.profitPrematch
    },
    {
      label: `Live (${stats.liveCount})`,
      value: eur(stats.profitLive),
      profit: stats.profitLive
    }
  ];

  const winRate = stats.n > 0 ? (stats.wins / stats.n * 100).toFixed(1) : "0";

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30">
      {/* Ambient Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />

      <div className="relative max-w-[1400px] mx-auto px-4 md:px-8 py-8 md:py-12">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-xs font-bold text-emerald-500 tracking-widest uppercase">Live Dashboard</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
              DDTips <span className="text-zinc-600">Overview</span>
            </h1>
            <p className="text-zinc-400 font-medium">Pregled celotnega portfelja stav</p>
          </div>
          
          <button
            onClick={loadRows}
            className="group p-3 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all duration-200 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] self-center md:self-auto"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
          </button>
        </header>

        {/* Row 1: Začetni kapital + Trenutno stanje */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
          <MetricCard
            title="Začetni kapital"
            value={eur(CAPITAL_TOTAL)}
            icon={<DollarSign className="w-5 h-5" />}
            accentColor="violet"
            big
          />
          <MetricCard
            title="Trenutno stanje"
            value={eur(stats.bankroll)}
            trend={stats.bankroll >= CAPITAL_TOTAL ? "up" : "down"}
            icon={<Wallet className="w-5 h-5" />}
            accentColor={stats.bankroll >= CAPITAL_TOTAL ? "emerald" : "rose"}
            big
          />
        </section>

        {/* Row 2: Celoten profit + ROI + Donos na kapital */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
          <MetricCard
            title="Celoten profit"
            value={eur(stats.profit)}
            trend={stats.profit >= 0 ? "up" : "down"}
            icon={<TrendingUp className="w-5 h-5" />}
            accentColor="emerald"
          />
          <MetricCard
            title="ROI"
            value={`${stats.roiPercent.toFixed(2)}%`}
            subtitle="Return on investment"
            icon={<Target className="w-5 h-5" />}
            accentColor="sky"
          />
          <MetricCard
            title="Donos na kapital"
            value={`${stats.donosNaKapital.toFixed(2)}%`}
            trend={stats.donosNaKapital >= 0 ? "up" : "down"}
            icon={<BarChart3 className="w-5 h-5" />}
            accentColor="amber"
          />
        </section>

        {/* Row 3: Skupaj stav + Win/Loss + Win Rate + Povprečna kvota */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          <MetricCard
            title="Skupaj stav"
            value={String(stats.n)}
            icon={<Activity className="w-5 h-5" />}
            accentColor="emerald"
          />
          <MetricCard
            title="Win / Loss"
            value={`${stats.wins} / ${stats.losses}`}
            icon={<Trophy className="w-5 h-5" />}
            accentColor="sky"
          />
          <MetricCard
            title="Win Rate"
            value={`${winRate}%`}
            icon={<Zap className="w-5 h-5" />}
            accentColor="violet"
          />
          <MetricCard
            title="Povp. Efektivna Kvota"
            value={stats.avgOdds ? stats.avgOdds.toFixed(2) : "-"}
            icon={<Target className="w-5 h-5" />}
            accentColor="amber"
          />
        </section>

        {/* Main Chart Section - enak kot stats */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Chart */}
            <div className="lg:col-span-2 rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-6 md:p-8">
                <div className="flex items-center justify-center md:justify-between mb-8">
                    <div className="text-center md:text-left">
                        <h3 className="text-lg font-bold text-white">Rast Profita</h3>
                        <p className="text-sm text-zinc-500">Kumulativni pregled po mesecih</p>
                    </div>
                    <div className="hidden md:flex gap-2">
                         <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Profit
                        </div>
                    </div>
                </div>
                
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartMonthly}>
                            <defs>
                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis 
                                dataKey="monthName" 
                                stroke="#52525b" 
                                fontSize={12} 
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                angle={-45}
                                textAnchor="end"
                                height={60}
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
                                formatter={(value: number | undefined) => [eur(value ?? 0), "Kumulativno"]}
                                labelFormatter={(label) => `Mesec: ${label}`}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="cumulative" 
                                stroke="#10b981" 
                                strokeWidth={2}
                                fillOpacity={1} 
                                fill="url(#colorProfit)" 
                                dot={{ fill: "#10b981", strokeWidth: 0, r: 4 }}
                                activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Bankroll / Bookies */}
            <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center gap-3 mb-6">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500"><Wallet className="w-5 h-5" /></div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-white">Stanja Stavnic</h3>
                        <p className="text-sm text-zinc-500">Razporeditev kapitala</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {stats.balanceByBook.map((book) => (
                        <BookCard key={book.name} book={book} />
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

        {/* Data Tables */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DataTable
            title="Po športih"
            data={sportData}
            icon={<Activity className="w-4 h-4" />}
          />
          <DataTable
            title="Po tipsterjih"
            data={tipsterData}
            icon={<Users className="w-4 h-4" />}
          />
          <DataTable
            title="Po času"
            data={timingData}
            icon={<Clock className="w-4 h-4" />}
          />
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-zinc-900 text-center flex flex-col md:flex-row justify-between items-center text-zinc-600 text-xs gap-2">
          <p>© 2024 DDTips Analytics. Vse pravice pridržane.</p>
          <p className="font-mono">Last updated: {new Date().toLocaleTimeString()}</p>
        </footer>
      </div>
    </main>
  );
}