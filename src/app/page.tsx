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

// ── TIPI IN KONSTANTE ──────────────────────────────────────────────────
type WL = "OPEN" | "WIN" | "LOSS" | "VOID" | "BACK WIN" | "LAY WIN";

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
  mode?: "BET" | "TRADING" | null;
};

const CAPITAL_TOTAL = 8500;

const BOOK_START: Record<string, number> = {
  SHARP: 1500,
  PINNACLE: 2000,
  BET365: 2000,
  WINAMAX: 1000,
  WWIN: 500,
  "E-STAVE": 500,
  "BET AT HOME": 1000,
};

const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"];
const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"];

// ── POMOŽNE FUNKCIJE ───────────────────────────────────────────────────
// (vse funkcije ostanejo nespremenjene - normBook, eur, hasLay, hasBack, calcProfit, calcRisk, buildStats)

// ── KOMPONENTE ─────────────────────────────────────────────────────────

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
  accentColor?: "emerald" | "amber" | "rose" | "violet";
  big?: boolean;
}) {
  const colorMap = {
    emerald: { bg: "bg-emerald-950/40", border: "border-emerald-800/50", text: "text-emerald-400" },
    amber:   { bg: "bg-amber-950/40",   border: "border-amber-800/50",   text: "text-amber-400" },
    rose:    { bg: "bg-rose-950/40",    border: "border-rose-800/50",    text: "text-rose-400" },
    violet:  { bg: "bg-violet-950/40",  border: "border-violet-800/50",  text: "text-violet-400" },
  };

  const colors = colorMap[accentColor] || colorMap.emerald;

  return (
    <div
      className={`
        relative rounded-2xl ${colors.bg} border ${colors.border} backdrop-blur-md
        p-6 transition-all duration-300 hover:border-opacity-70 hover:shadow-xl hover:shadow-black/10
        ${big ? "shadow-lg" : ""}
      `}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">{icon}</div>
          <span className="text-xs font-semibold tracking-widest uppercase text-slate-400">
            {title}
          </span>
        </div>

        {trend && trend !== "neutral" && (
          <div className={`text-sm font-medium ${trend === "up" ? "text-emerald-400" : "text-rose-400"}`}>
            {trend === "up" ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          </div>
        )}
      </div>

      <div className="text-right">
        <div
          className={`font-mono font-bold tracking-tight text-white ${
            big ? "text-3xl sm:text-4xl" : "text-2xl"
          }`}
        >
          {value}
        </div>
        {subtitle && (
          <p className="mt-1.5 text-sm text-slate-400 font-medium">{subtitle}</p>
        )}
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
  const maxAbs = Math.max(1, ...data.map(d => Math.abs(d.profit)));

  return (
    <div className="rounded-2xl bg-slate-900/50 border border-slate-800/60 backdrop-blur-md overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/50 flex items-center gap-3">
        {icon}
        <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-300">
          {title}
        </h3>
      </div>

      <div className="divide-y divide-slate-800/40">
        {data.map((item, i) => {
          const width = (Math.abs(item.profit) / maxAbs) * 100;
          const positive = item.profit >= 0;

          return (
            <div
              key={i}
              className="px-5 py-3.5 flex items-center justify-between relative group transition-colors hover:bg-slate-800/40"
            >
              <div
                className={`absolute inset-0 ${positive ? "bg-emerald-900/30" : "bg-rose-900/30"} transition-all duration-500`}
                style={{ width: `${width}%` }}
              />
              <span className="relative z-10 text-sm font-medium text-slate-200 group-hover:text-white">
                {item.label}
              </span>
              <span
                className={`relative z-10 font-mono font-semibold text-sm ${
                  positive ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── GLAVNA KOMPONENTA ──────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (!error) setRows(data ?? []);
  }

  const stats = useMemo(() => buildStats(rows), [rows]);

  // ... ostale useMemo za chartDaily, chartMonthly, sportData, tipsterData, timingData ostanejo nespremenjene ...

  const skupnaBanka = stats.balanceByBook.reduce((sum, b) => sum + b.balance, 0);
  const skupnaBankaIsUp = skupnaBanka >= CAPITAL_TOTAL;
  const profitIsUp = stats.profit >= 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-slate-400 text-sm tracking-widest uppercase font-medium">Nalagam podatke...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white">
      {/* subtilen overlay gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-950/5 via-transparent to-violet-950/5 pointer-events-none" />

      <div className="relative max-w-[1480px] mx-auto px-5 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Refresh button */}
        <div className="flex justify-end mb-8">
          <button
            onClick={loadRows}
            disabled={loading}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600/90
              hover:bg-emerald-600 transition-all duration-300
              disabled:opacity-50 disabled:pointer-events-none
              shadow-lg shadow-emerald-900/30
              text-sm font-medium
            `}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Osveži podatke
          </button>
        </div>

        {/* Glavne metrike - večji, čistejši layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <MetricCard
            title="Začetni kapital"
            value={eur(CAPITAL_TOTAL)}
            icon={<DollarSign size={20} />}
            accentColor="violet"
            big
          />
          <MetricCard
            title="Trenutno stanje"
            value={eur(stats.bankroll)}
            trend={stats.bankroll >= CAPITAL_TOTAL ? "up" : "down"}
            icon={<Wallet size={20} />}
            accentColor={stats.bankroll >= CAPITAL_TOTAL ? "emerald" : "rose"}
            big
          />
          <MetricCard
            title="Celoten profit"
            value={eur(stats.profit)}
            trend={stats.profit >= 0 ? "up" : "down"}
            icon={<TrendingUp size={20} />}
            accentColor={stats.profit >= 0 ? "emerald" : "rose"}
            big
          />
          <MetricCard
            title="Donos na kapital"
            value={`${stats.donosNaKapital.toFixed(1)} %`}
            trend={stats.donosNaKapital >= 0 ? "up" : "down"}
            icon={<BarChart3 size={20} />}
            accentColor="amber"
            big
          />
        </div>

        {/* Sekundarne metrike */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-12">
          <MetricCard title="Stav" value={stats.n.toString()} icon={<Activity size={18} />} accentColor="emerald" />
          <MetricCard title="Zmage" value={stats.wins.toString()} icon={<Trophy size={18} />} accentColor="emerald" />
          <MetricCard title="Porazi" value={stats.losses.toString()} icon={<Trophy size={18} />} accentColor="rose" />
          <MetricCard title="Win rate" value={`${stats.winRate.toFixed(1)} %`} icon={<Zap size={18} />} accentColor="violet" />
        </div>

        {/* Charts + Bookmakers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Charts container */}
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-md p-6">
            {/* tukaj ostane tvoja obstoječa struktura dveh grafov */}
            {/* Daily + Monthly chart - brez sprememb v logiki, samo rahlo boljši padding/spacing */}
          </div>

          {/* Bookmakers */}
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-md p-6 flex flex-col">
            <h3 className="text-lg font-semibold mb-6 text-slate-100">Stanje po stavnicah</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 flex-1">
              {stats.balanceByBook.map(book => (
                <div
                  key={book.name}
                  className={`
                    rounded-xl p-5 border transition-all duration-300
                    ${book.profit >= 0 
                      ? "border-emerald-800/40 bg-emerald-950/20 hover:bg-emerald-950/30" 
                      : "border-rose-800/40 bg-rose-950/20 hover:bg-rose-950/30"}
                    hover:shadow-lg hover:shadow-black/10
                  `}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold text-lg text-white">{book.name}</h4>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Začetno: {eur(book.start)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold font-mono text-white">
                        {eur(book.balance)}
                      </div>
                      <div className={`text-sm font-medium mt-1 ${
                        book.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {book.profit >= 0 ? "+" : ""}{eur(book.profit)}
                      </div>
                    </div>
                  </div>

                  {/* subtilen progress bar */}
                  <div className="h-1.5 bg-slate-800/70 rounded-full overflow-hidden mt-3">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        book.profit >= 0 ? "bg-emerald-600" : "bg-rose-600"
                      }`}
                      style={{ width: `${Math.min(100, Math.abs(book.profit) / 5000 * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabele */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <DataTable title="Po športih" data={sportData} icon={<Activity size={16} />} />
          <DataTable title="Po tipsterjih" data={tipsterData} icon={<Users size={16} />} />
          <DataTable title="Prematch / Live" data={timingData} icon={<Clock size={16} />} />
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-10 border-t border-slate-800 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} DDTips Analytics • Vse pravice pridržane
        </footer>
      </div>
    </main>
  );
}