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
  Clock
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

  const bankroll = CAPITAL_TOTAL + profit;

  const totalStakes = settled.reduce((acc, r) => acc + r.vplacilo1, 0);
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
    emerald: "from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/20",
    amber: "from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/20",
    rose: "from-rose-500/20 via-rose-500/5 to-transparent border-rose-500/20",
    sky: "from-sky-500/20 via-sky-500/5 to-transparent border-sky-500/20",
    violet: "from-violet-500/20 via-violet-500/5 to-transparent border-violet-500/20",
  };

  const iconColors = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    sky: "text-sky-400",
    violet: "text-violet-400",
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors[accentColor]} border backdrop-blur-sm p-6 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl group`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-400">{title}</span>
          {icon && <div className={`${iconColors[accentColor]} opacity-60`}>{icon}</div>}
        </div>
        
        <div className="flex items-end gap-3">
          <span className={`text-3xl font-light tracking-tight ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-white"}`}>
            {value}
          </span>
          {trend && (
            <span className={`text-sm font-medium pb-1 ${trend === "up" ? "text-emerald-400" : "text-rose-400"}`}>
              {trend === "up" ? "↑" : "↓"}
            </span>
          )}
        </div>
        
        {subtitle && (
          <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function DataTable({ 
  title, 
  data, 
  icon,
  columns = 1
}: { 
  title: string; 
  data: { label: string; value: string; profit: number }[];
  icon?: React.ReactNode;
  columns?: 1 | 2;
}) {
  const maxProfit = Math.max(...data.map(d => Math.abs(d.profit)));
  
  return (
    <div className="rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center gap-3">
        {icon && <div className="text-zinc-400">{icon}</div>}
        <h3 className="text-sm font-semibold tracking-[0.15em] uppercase text-zinc-300">{title}</h3>
      </div>
      
      <div className={`p-4 ${columns === 2 ? "grid grid-cols-2 gap-2" : "space-y-1"}`}>
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
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900/60 to-zinc-950/60 border border-zinc-800/30 p-5 transition-all duration-300 hover:border-zinc-700/50 hover:shadow-xl">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${isPositive ? "from-emerald-500/5" : "from-rose-500/5"} to-transparent`} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold tracking-[0.15em] uppercase text-zinc-500">{book.name}</span>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isPositive ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
            {isPositive ? "+" : ""}{percentChange.toFixed(1)}%
          </span>
        </div>
        
        <div className="mb-3">
          <span className={`text-2xl font-light tracking-tight ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
            {eur(book.balance)}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Začetek: {eur(book.start)}</span>
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
        return { month: m, profit, cumulative };
      });

    return arr;
  }, [rows]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-zinc-500 text-sm tracking-widest uppercase">Nalagam...</span>
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
    <main className="min-h-screen bg-zinc-950 text-white antialiased">
      {/* Subtle background texture */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black" />
      <div className="fixed inset-0 opacity-30" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")" }} />
      
      <div className="relative max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-extralight tracking-tight text-white mb-2">
                Portfolio <span className="text-emerald-400">Dashboard</span>
              </h1>
              <p className="text-zinc-500 text-sm tracking-wide">
                Začetni kapital: <span className="text-zinc-300 font-medium">{eur(CAPITAL_TOTAL)}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Trenutno stanje</div>
              <div className={`text-3xl font-light ${stats.bankroll >= CAPITAL_TOTAL ? "text-emerald-400" : "text-rose-400"}`}>
                {eur(stats.bankroll)}
              </div>
            </div>
          </div>
        </header>

        {/* Primary Metrics */}
        <section className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Celoten profit"
            value={eur(stats.profit)}
            trend={stats.profit >= 0 ? "up" : "down"}
            icon={<TrendingUp className="w-5 h-5" />}
            accentColor="emerald"
          />
          <MetricCard
            title="Donos na kapital"
            value={`${stats.donosNaKapital.toFixed(2)}%`}
            trend={stats.donosNaKapital >= 0 ? "up" : "down"}
            icon={<Target className="w-5 h-5" />}
            accentColor="amber"
          />
          <MetricCard
            title="ROI"
            value={`${stats.roiPercent.toFixed(2)}%`}
            subtitle="Return on investment"
            icon={<DollarSign className="w-5 h-5" />}
            accentColor="sky"
          />
          <MetricCard
            title="Win Rate"
            value={`${winRate}%`}
            subtitle={`${stats.wins}W / ${stats.losses}L`}
            icon={<Trophy className="w-5 h-5" />}
            accentColor="violet"
          />
        </section>

        {/* Secondary Metrics */}
        <section className="grid grid-cols-3 gap-4 mb-8">
          <MetricCard
            title="Skupaj stav"
            value={String(stats.n)}
            icon={<BarChart3 className="w-5 h-5" />}
            accentColor="emerald"
          />
          <MetricCard
            title="Povprečna kvota"
            value={stats.avgOdds ? stats.avgOdds.toFixed(2) : "-"}
            icon={<Zap className="w-5 h-5" />}
            accentColor="amber"
          />
          <MetricCard
            title="Win / Loss"
            value={`${stats.wins} / ${stats.losses}`}
            icon={<Activity className="w-5 h-5" />}
            accentColor="sky"
          />
        </section>

        {/* Chart */}
        <section className="mb-8">
          <div className="rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800/50">
              <h3 className="text-sm font-semibold tracking-[0.15em] uppercase text-zinc-300">Kumulativni profit</h3>
            </div>
            <div className="p-6" style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartMonthly}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#52525b" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
  stroke="#52525b"
  fontSize={11}
  tickLine={false}
  axisLine={false}
  tickFormatter={(value) => `€${value}`}
/>

<Tooltip
  formatter={(value: number | undefined, name: string | undefined) => {
    const safe = typeof value === "number" ? value : 0;
    const formatted = eur(Math.round(safe * 100) / 100);

    const label =
      name === "cumulative" ? "Kumulativno" : name === "monthly" ? "Mesečno" : "Mesečno";

    return [formatted, label] as const;
  }}
  contentStyle={{
    backgroundColor: "rgba(24, 24, 27, 0.95)",
    border: "1px solid rgba(63, 63, 70, 0.5)",
    borderRadius: "12px",
    padding: "12px 16px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
  }}
  labelStyle={{ color: "#a1a1aa", fontSize: 11, marginBottom: 4 }}
  itemStyle={{ color: "#fff", fontSize: 13 }}
/>


<Area
  type="monotone"
  dataKey="cumulative"
  stroke="#10b981"
  strokeWidth={2}
  fill="url(#profitGradient)"
  dot={{ fill: "#10b981", strokeWidth: 0, r: 3 }}
  activeDot={{
    r: 5,
    fill: "#10b981",
    stroke: "#fff",
    strokeWidth: 2,
  }}
/>

                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Bookmakers Grid */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-5 h-5 text-zinc-400" />
            <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-zinc-300">Stavnice</h2>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {stats.balanceByBook.map((book) => (
              <BookCard key={book.name} book={book} />
            ))}
          </div>
        </section>

        {/* Data Tables */}
        <section className="grid grid-cols-3 gap-6">
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
        <footer className="mt-16 pt-8 border-t border-zinc-800/50">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>Betting Portfolio Dashboard</span>
            <span>Zadnja posodobitev: {new Date().toLocaleDateString("sl-SI")}</span>
          </div>
        </footer>
      </div>
    </main>
  );
}