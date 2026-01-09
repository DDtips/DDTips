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
  Trophy,
  BarChart3,
  Users,
  Activity,
  Zap,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from "lucide-react";

// --- TIPOVI IN KONSTANTE ---

// POPRAVEK: Dodani statusi BACK WIN in LAY WIN
type WL = "OPEN" | "WIN" | "LOSS" | "VOID" | "BACK WIN" | "LAY WIN";

type Bet = {
  id: string;
  datum: string;
  wl: WL;
  kvota1: number;
  vplacilo1: number;
  lay_kvota: number;
  vplacilo2: number; // LIABILITY
  komisija: number;
  sport: string;
  cas_stave: string;
  tipster: string;
  stavnica: string;
  mode?: "BET" | "TRADING" | null;
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

// --- POMOŽNE FUNKCIJE ---

function normBook(x: string) {
  return (x || "").toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}

function eur(n: number) {
  return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function hasLay(b: Bet) {
  return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0;
}

function hasBack(b: Bet) {
  return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0;
}

// POPRAVEK: Nova logika za izračun profita (Liability & Statusi)
function calcProfit(b: Bet): number {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;

  const komZnesek = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0;
  const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0; // Vnos je Liability
  const layOdds = b.lay_kvota || 0;
  
  // Izračunamo Lay Stake iz Liability
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;

  let brutoProfit = 0;

  // 1. TRADING
  if (hasBack(b) && hasLay(b)) {
    const profitIfBackWins = (backStake * (backOdds - 1)) - layLiability;
    const profitIfLayWins = layStake - backStake;

    if (b.wl === "BACK WIN") brutoProfit = profitIfBackWins;
    else if (b.wl === "LAY WIN") brutoProfit = profitIfLayWins;
    else if (b.wl === "WIN") brutoProfit = Math.max(profitIfBackWins, profitIfLayWins);
    else if (b.wl === "LOSS") brutoProfit = Math.min(profitIfBackWins, profitIfLayWins);
  }

  // 2. SAMO LAY
  else if (!hasBack(b) && hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") brutoProfit = layStake;
    else if (b.wl === "LOSS" || b.wl === "BACK WIN") brutoProfit = -layLiability;
  }

  // 3. SAMO BACK
  else if (hasBack(b) && !hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") brutoProfit = backStake * (backOdds - 1);
    else if (b.wl === "LOSS" || b.wl === "LAY WIN") brutoProfit = -backStake;
  }

  // Odštevanje komisije (samo če je profit)
  if (brutoProfit > 0) return brutoProfit - komZnesek;
  return brutoProfit;
}

// POPRAVEK: Nova logika za izračun tveganja (Risk)
function calcRisk(b: Bet): number {
  const hasBackBet = hasBack(b);
  const hasLayBet = hasLay(b);
  const backStake = b.vplacilo1 || 0;
  const layLiability = b.vplacilo2 || 0; // Liability

  if (hasBackBet && !hasLayBet) return backStake;
  if (!hasBackBet && hasLayBet) return layLiability;
  if (hasBackBet && hasLayBet) return Math.max(backStake, layLiability);
  return 0;
}

function buildStats(rows: Bet[]) {
  // POPRAVEK: Filter upošteva nove statuse
  const settled = rows.filter((r) => r.wl !== "OPEN" && r.wl !== "VOID");
  
  const n = settled.length;
  // Zmage so WIN, BACK WIN ali LAY WIN
  const wins = settled.filter((r) => r.wl === "WIN" || r.wl === "BACK WIN" || r.wl === "LAY WIN").length;
  const losses = settled.filter((r) => r.wl === "LOSS").length;

  const profit = settled.reduce((acc, r) => acc + calcProfit(r), 0);
  const bankroll = CAPITAL_TOTAL + profit;
  const totalRisk = settled.reduce((acc, r) => acc + calcRisk(r), 0);
  const roiPercent = totalRisk === 0 ? 0 : (profit / totalRisk) * 100;
  const donosNaKapital = ((bankroll - CAPITAL_TOTAL) / CAPITAL_TOTAL) * 100;
  const winRate = n > 0 ? (wins / n) * 100 : 0;

  // Profit po stavnicah
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

  // Dodaj stavnice, ki niso v BOOK_START, a so v bazi
  profitByBook.forEach((p, key) => {
    const exists = Object.keys(BOOK_START).some((name) => normBook(name) === key);
    if (!exists) {
      balanceByBook.push({ name: key, start: 0, profit: p, balance: p });
    }
  });

  balanceByBook.sort((a, b) => b.balance - a.balance);

  // Profit po športih
  const profitBySport = new Map<string, number>();
  SPORTI.forEach((sport) => profitBySport.set(sport, 0));
  settled.forEach((r) => {
    const key = r.sport || "OSTALO";
    profitBySport.set(key, (profitBySport.get(key) ?? 0) + calcProfit(r));
  });

  // Profit po tipsterjih
  const profitByTipster = new Map<string, number>();
  TIPSTERJI.forEach((tipster) => profitByTipster.set(tipster, 0));
  settled.forEach((r) => {
    const key = r.tipster || "NEZNANO";
    profitByTipster.set(key, (profitByTipster.get(key) ?? 0) + calcProfit(r));
  });

  const prematch = settled.filter((r) => r.cas_stave === "PREMATCH");
  const live = settled.filter((r) => r.cas_stave === "LIVE");
  const profitPrematch = prematch.reduce((acc, r) => acc + calcProfit(r), 0);
  const profitLive = live.reduce((acc, r) => acc + calcProfit(r), 0);

  return {
    profit,
    bankroll,
    donosNaKapital,
    roiPercent,
    n,
    wins,
    losses,
    winRate,
    balanceByBook,
    profitBySport,
    profitByTipster,
    profitPrematch,
    profitLive,
    prematchCount: prematch.length,
    liveCount: live.length,
  };
}

// --- KOMPONENTE UI ---

function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  accentColor = "emerald",
  big = false,
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
  } as const;

  const textColors = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    sky: "text-sky-400",
    violet: "text-violet-400",
  } as const;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradients[accentColor]} border backdrop-blur-md transition-all duration-300 hover:-translate-y-1`}
    >
      <div className="p-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className={`p-1.5 rounded-lg bg-white/5 ${textColors[accentColor]}`}>{icon}</div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">{title}</span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <span className={`${big ? "text-2xl md:text-3xl" : "text-xl"} font-bold tracking-tight text-white`}>
            {value}
          </span>
          {trend && trend !== "neutral" && (
            <div className={`flex items-center text-sm font-medium ${trend === "up" ? "text-emerald-400" : "text-rose-400"}`}>
              {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            </div>
          )}
        </div>

        {subtitle && <p className="mt-1 text-xs text-zinc-400 font-medium">{subtitle}</p>}
      </div>
    </div>
  );
}

function DataTable({
  title,
  data,
  icon,
}: {
  title: string;
  data: { label: string; value: string; profit: number }[];
  icon?: React.ReactNode;
}) {
  const maxProfit = Math.max(...data.map((d) => Math.abs(d.profit)));

  return (
    <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-center gap-2">
        {icon && <div className="text-zinc-400">{icon}</div>}
        <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-300">{title}</h3>
      </div>

      <div className="p-3 space-y-1">
        {data.map((item, idx) => {
          const barWidth = maxProfit > 0 ? (Math.abs(item.profit) / maxProfit) * 100 : 0;
          const isPositive = item.profit >= 0;

          return (
            <div
              key={idx}
              className="relative flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <div
                className={`absolute left-0 top-0 bottom-0 rounded-lg transition-all duration-500 ${
                  isPositive ? "bg-emerald-500/10" : "bg-rose-500/10"
                }`}
                style={{ width: `${barWidth}%` }}
              />
              <span className="relative z-10 text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
                {item.label}
              </span>
              <span className={`relative z-10 text-xs font-semibold tabular-nums ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- GLAVNA STRAN ---

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
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: true });
    setLoading(false);
    if (error) return;
    setRows((data ?? []) as Bet[]);
  }

  const stats = useMemo(() => buildStats(rows), [rows]);

  // Dnevni graf (tekoči mesec)
  const chartDaily = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const settled = rows.filter((r) => {
      if (r.wl === "OPEN" || r.wl === "VOID") return false;
      const d = new Date(r.datum);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const map = new Map<number, number>();
    settled.forEach((r) => {
      const day = new Date(r.datum).getDate();
      map.set(day, (map.get(day) ?? 0) + calcProfit(r));
    });

    let cumulative = 0;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const arr: { day: number; dayLabel: string; profit: number; daily: number }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const daily = map.get(d) ?? 0;
      cumulative += daily;
      // Prikažemo do današnjega dne (ali do konca meseca, če gledamo za nazaj)
      if (d <= now.getDate() || now.getMonth() !== currentMonth) {
         arr.push({ day: d, dayLabel: `${d}.`, profit: cumulative, daily });
      }
    }

    return arr;
  }, [rows]);

  // Mesečni graf (tekoče leto)
  const chartMonthly = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const settled = rows
      .filter((r) => {
        if (r.wl === "OPEN" || r.wl === "VOID") return false;
        const d = new Date(r.datum);
        return d.getFullYear() === currentYear;
      })
      .sort((a, b) => +new Date(a.datum) - +new Date(b.datum));

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];

    const monthProfit = new Map<number, number>();
    settled.forEach((r) => {
      const month = new Date(r.datum).getMonth();
      monthProfit.set(month, (monthProfit.get(month) ?? 0) + calcProfit(r));
    });

    let cum = 0;
    return monthNames.map((name, idx) => {
      cum += monthProfit.get(idx) ?? 0;
      return { month: idx, monthName: name, profit: cum };
    });
  }, [rows]);

  const currentMonthName = new Date().toLocaleDateString("sl-SI", { month: "long", year: "numeric" });
  const currentYearName = new Date().getFullYear();

  const sportData = useMemo(
    () =>
      SPORTI.map((sport) => ({
        label: sport,
        value: eur(stats.profitBySport.get(sport) ?? 0),
        profit: stats.profitBySport.get(sport) ?? 0,
      })).sort((a, b) => b.profit - a.profit),
    [stats]
  );

  const tipsterData = useMemo(
    () =>
      TIPSTERJI.map((tipster) => ({
        label: tipster,
        value: eur(stats.profitByTipster.get(tipster) ?? 0),
        profit: stats.profitByTipster.get(tipster) ?? 0,
      })).sort((a, b) => b.profit - a.profit),
    [stats]
  );

  const timingData = useMemo(
    () => [
      { label: `Prematch (${stats.prematchCount})`, value: eur(stats.profitPrematch), profit: stats.profitPrematch },
      { label: `Live (${stats.liveCount})`, value: eur(stats.profitLive), profit: stats.profitLive },
    ],
    [stats]
  );

  const skupnaBanka = stats.balanceByBook.reduce((a, b) => a + b.balance, 0);
  const skupnaBankaIsUp = skupnaBanka >= CAPITAL_TOTAL;
  const profitIsUp = stats.profit >= 0;

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

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>

      <div className="relative max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-10">
        
        {/* HEADER PO MERI */}
        <div className="relative mb-8 mt-2 h-10">
          <button
            onClick={loadRows}
            className="absolute top-0 right-0 group p-2.5 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all duration-200 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
          </button>
        </div>

        {/* Row 1 */}
        <section className="grid grid-cols-2 gap-4 mb-4">
          <MetricCard
            title="Začetni kapital"
            value={eur(CAPITAL_TOTAL)}
            icon={<DollarSign className="w-4 h-4" />}
            accentColor="violet"
            big
          />
          <MetricCard
            title="Trenutno stanje"
            value={eur(stats.bankroll)}
            trend={stats.bankroll >= CAPITAL_TOTAL ? "up" : "down"}
            icon={<Wallet className="w-4 h-4" />}
            accentColor={stats.bankroll >= CAPITAL_TOTAL ? "emerald" : "rose"}
            big
          />
        </section>

        {/* Row 2 (SAMO profit + donos) */}
        <section className="grid grid-cols-2 gap-4 mb-4">
          <MetricCard
            title="Celoten profit"
            value={eur(stats.profit)}
            trend={stats.profit >= 0 ? "up" : "down"}
            icon={<TrendingUp className="w-4 h-4" />}
            accentColor={stats.profit >= 0 ? "emerald" : "rose"}
            big
          />
          <MetricCard
            title="Donos na kapital"
            value={`${stats.donosNaKapital.toFixed(2)}%`}
            trend={stats.donosNaKapital >= 0 ? "up" : "down"}
            icon={<BarChart3 className="w-4 h-4" />}
            accentColor="amber"
            big
          />
        </section>

        {/* Row 3 (Skupaj + WIN + LOSS + WinRate) */}
        <section className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard title="Skupaj stav" value={String(stats.n)} icon={<Activity className="w-4 h-4" />} accentColor="emerald" />
          <MetricCard title="WIN" value={String(stats.wins)} icon={<Trophy className="w-4 h-4" />} accentColor="emerald" />
          <MetricCard title="LOSS" value={String(stats.losses)} icon={<Trophy className="w-4 h-4" />} accentColor="rose" />
          <MetricCard title="Win Rate" value={`${stats.winRate.toFixed(1)}%`} icon={<Zap className="w-4 h-4" />} accentColor="violet" />
        </section>

        {/* Charts + Books layout */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 items-stretch">
          
          {/* LEFT: charts */}
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-5 flex flex-col h-full">
            {/* Daily */}
            <div>
              <div className="flex items-center justify-center mb-4">
                <div className="text-center">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Dnevni Profit - {currentMonthName}</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Kumulativno</p>
                </div>
              </div>

              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDaily}>
                    <defs>
                      <linearGradient id="colorProfitDaily" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="dayLabel" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "12px", fontSize: "12px" }}
                      itemStyle={{ color: "#fff" }}
                      labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
                      formatter={(value: number | undefined) => [eur(value ?? 0), "Kumulativno"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorProfitDaily)"
                      dot={{ fill: "#10b981", strokeWidth: 0, r: 2 }}
                      activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="my-5 border-t border-zinc-800/50" />

            {/* Monthly cumulative */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-center mb-4">
                <div className="text-center">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Rast Profita - {currentYearName}</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Kumulativno po mesecih</p>
                </div>
              </div>

              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartMonthly}>
                    <defs>
                      <linearGradient id="colorProfitMonthly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="monthName" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "12px", fontSize: "12px" }}
                      itemStyle={{ color: "#fff" }}
                      labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
                      formatter={(value: number | undefined) => [eur(value ?? 0), "Kumulativno"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorProfitMonthly)"
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* RIGHT: bookmakers */}
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-4 flex flex-col h-full min-h-[500px]">
            {/* Summary cards at top of right panel */}
             <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-2 text-center">
                <div className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-1">Začetno</div>
                <div className="text-xs font-mono text-zinc-200">{eur(CAPITAL_TOTAL)}</div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 p-2 text-center">
                <div className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-1">Skupna banka</div>
                <div className={`text-xs font-mono font-semibold ${skupnaBankaIsUp ? "text-emerald-300" : "text-rose-300"}`}>
                  {eur(skupnaBanka)}
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 p-2 text-center">
                <div className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-1">Profit</div>
                <div className={`text-xs font-mono font-semibold ${profitIsUp ? "text-emerald-300" : "text-rose-300"}`}>
                  {eur(stats.profit)}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                {stats.balanceByBook.map((book) => {
                  const isPositive = book.profit >= 0;
                  const themeClasses = isPositive
                    ? "border-emerald-500/20 hover:border-emerald-500/50 bg-gradient-to-br from-zinc-900/80 to-emerald-950/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.1)]"
                    : "border-rose-500/20 hover:border-rose-500/50 bg-gradient-to-br from-zinc-900/80 to-rose-950/20 shadow-[0_0_15px_-5px_rgba(244,63,94,0.1)]";
                  
                  const textTheme = isPositive ? "text-emerald-400" : "text-rose-400";

                  return (
                    <div
                      key={book.name}
                      className={`col-span-1 rounded-2xl border backdrop-blur-md p-4 transition-all duration-300 group hover:-translate-y-0.5 flex flex-col justify-between min-h-[110px] ${themeClasses}`}
                    >
                      <div className="text-center mb-3">
                        <h4 className={`text-sm font-black tracking-wide uppercase ${isPositive ? 'text-emerald-100' : 'text-rose-100'}`}>
                          {book.name}
                        </h4>
                        <div className={`h-px w-1/3 mx-auto mt-2 ${isPositive ? 'bg-emerald-500/30' : 'bg-rose-500/30'}`}></div>
                      </div>

                      <div className="flex items-end justify-between">
                        <div className="flex flex-col items-start">
                          <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-1">Začetno</span>
                          <span className="text-xs font-mono text-zinc-400 font-medium">{eur(book.start)}</span>
                        </div>

                        <div className="flex flex-col items-end">
                           <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-0.5">Trenutno</span>
                           <div className="flex items-center gap-1">
                              {isPositive ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-rose-400" />}
                              <span className={`text-base font-mono font-black ${textTheme}`}>
                              {eur(book.balance)}
                              </span>
                           </div>
                           <span className={`text-[9px] font-medium opacity-70 ${textTheme}`}>
                              ({isPositive ? "+" : ""}{eur(book.profit)})
                           </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Data Tables */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DataTable title="Po športih" data={sportData} icon={<Activity className="w-3 h-3" />} />
          <DataTable title="Po tipsterjih" data={tipsterData} icon={<Users className="w-3 h-3" />} />
          <DataTable title="Po času" data={timingData} icon={<Clock className="w-3 h-3" />} />
        </section>

        <footer className="mt-8 pt-6 border-t border-zinc-900 text-center flex flex-col md:flex-row justify-between items-center text-zinc-600 text-xs gap-2">
          <p>© 2024 DDTips Analytics. Vse pravice pridržane.</p>
          <p className="font-mono">Last updated: {new Date().toLocaleTimeString()}</p>
        </footer>
      </div>
    </main>
  );
}