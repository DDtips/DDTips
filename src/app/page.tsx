"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp, DollarSign, Target, Trophy, BarChart3, Building2, Users, Activity } from "lucide-react";

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

const CAPITAL_TOTAL = 7000;

const BOOK_START: Record<string, number> = {
  SHARP: 2000,
  PINNACLE: 2000,
  BET365: 2000,
  WINAMAX: 1000,
  WWIN: 0,
  "E-STAVE": 0,
};

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

  const roi = profit / CAPITAL_TOTAL;
  const bankroll = CAPITAL_TOTAL + profit;

  // Profit po stavnicah
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

  // Profit po športih
  const profitBySport = new Map<string, number>();
  settled.forEach((r) => {
    const key = r.sport || "OSTALO";
    profitBySport.set(key, (profitBySport.get(key) ?? 0) + calcProfit(r));
  });

  // Profit po tipsterjih
  const profitByTipster = new Map<string, number>();
  settled.forEach((r) => {
    const key = r.tipster || "NEZNANO";
    profitByTipster.set(key, (profitByTipster.get(key) ?? 0) + calcProfit(r));
  });

  // Profit po PREMATCH/LIVE
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
    roi, 
    bankroll, 
    balanceByBook,
    profitBySport,
    profitByTipster,
    profitPrematch,
    profitLive,
    prematchCount: prematch.length,
    liveCount: live.length
  };
}

function StatCard({ 
  title, 
  value, 
  color = "#ffffff", 
  icon,
  bgGradient = "from-green-500/10 to-yellow-500/10"
}: { 
  title: string; 
  value: string; 
  color?: string; 
  icon?: React.ReactNode;
  bgGradient?: string;
}) {
  return (
    <div className="relative group h-full">
      <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} rounded-2xl blur-xl group-hover:blur-2xl transition-all`}></div>
<div className="relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20 hover:border-green-500/50 transition-all hover:scale-105 shadow-xl h-full flex flex-col justify-between">
        <div className="flex items-center gap-3 text-white/70 text-sm font-semibold mb-3">
          {icon && <div className="bg-gradient-to-br from-green-500 to-yellow-500 p-2 rounded-lg">{icon}</div>}
          {title}
        </div>
        <div className="text-3xl font-black" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

function TableCard({ 
  title, 
  data, 
  icon 
}: { 
  title: string; 
  data: { label: string; value: string; color: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-yellow-500/10 rounded-2xl blur-xl"></div>
      <div className="relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
        <h3 className="text-white font-black text-xl mb-4 flex items-center gap-3">
          {icon && <div className="bg-gradient-to-br from-green-500 to-yellow-500 p-2 rounded-lg">{icon}</div>}
          {title}
        </h3>
        <div className="space-y-2">
          {data.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-white/10">
              <span className="text-white/80 font-semibold">{item.label}</span>
              <span className="font-black text-lg" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}
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
    settled.forEach((r) => {
      const key = monthKey(r.datum);
      map.set(key, (map.get(key) ?? 0) + calcProfit(r));
    });

    const arr = Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([m, profit]) => ({ month: m, profit }));

    let cum = 0;
    return arr.map((x) => {
      cum += x.profit;
      return { ...x, cum };
    });
  }, [rows]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950">
        <div className="text-white text-xl">Nalagam...</div>
      </div>
    );
  }

  // Pripravi podatke za tabele
  const sportData = Array.from(stats.profitBySport.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([sport, profit]) => ({
      label: sport,
      value: eur(profit),
      color: profit >= 0 ? "#22c55e" : "#ef4444"
    }));

  const tipsterData = Array.from(stats.profitByTipster.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tipster, profit]) => ({
      label: tipster,
      value: eur(profit),
      color: profit >= 0 ? "#22c55e" : "#ef4444"
    }));

  const prematchLiveData = [
    {
      label: `PREMATCH (${stats.prematchCount})`,
      value: eur(stats.profitPrematch),
      color: stats.profitPrematch >= 0 ? "#22c55e" : "#ef4444"
    },
    {
      label: `LIVE (${stats.liveCount})`,
      value: eur(stats.profitLive),
      color: stats.profitLive >= 0 ? "#22c55e" : "#ef4444"
    }
  ];

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{animationDelay: "1s"}}></div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">Dashboard 2025</h1>
          <div className="text-white/60">Celotna statistika vseh stav</div>
        </div>

        {/* Glavni KPI */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-yellow-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-white">Skupna statistika</h2>
              <div className="text-xl font-bold text-white/80">
                Začetni kapital: <span className="text-green-400">{eur(CAPITAL_TOTAL)}</span>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-4 items-stretch">
              <StatCard
                title="SKUPAJ 2025"
                value={eur(stats.profit)}
                color={stats.profit >= 0 ? "#22c55e" : "#ef4444"}
                icon={<TrendingUp className="w-5 h-5 text-white" />}
              />
              <StatCard
                title="Bankroll"
                value={eur(stats.bankroll)}
                color={stats.bankroll >= CAPITAL_TOTAL ? "#22c55e" : "#ef4444"}
                icon={<DollarSign className="w-5 h-5 text-white" />}
              />
              <StatCard
                title="Donos na kapital"
                value={`${((stats.profit / CAPITAL_TOTAL) * 100).toFixed(2)}%`}
                color="#fbbf24"
                icon={<Target className="w-5 h-5 text-white" />}
              />
              <StatCard
                title="Stav (WIN/LOSS)"
                value={`${stats.n}`}
                color="#ffffff"
                icon={<BarChart3 className="w-5 h-5 text-white" />}
              />
              <StatCard
                title="WIN / LOSS"
                value={`${stats.wins} / ${stats.losses}`}
                color="#10b981"
                icon={<Trophy className="w-5 h-5 text-white" />}
              />
              <StatCard
                title="Povp. kvota"
                value={stats.avgOdds ? stats.avgOdds.toFixed(2) : "-"}
                color="#60a5fa"
              />
            </div>
          </div>
        </div>

        {/* Stavnice */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h3 className="text-white font-black text-xl mb-6 flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2 rounded-lg">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              Stanje na stavnicah
            </h3>

            <div className="grid grid-cols-3 gap-4">
              {stats.balanceByBook.map((x) => (
                <div key={x.name} className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl blur-lg group-hover:blur-xl transition-all"></div>
                  <div className="relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl border border-white/10 rounded-xl p-5 hover:bg-white/15 hover:border-blue-500/30 transition-all hover:scale-105 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-white font-black text-lg">{x.name}</div>
                      <div className={`text-2xl font-black ${x.balance >= x.start ? 'text-green-400' : 'text-red-400'}`}>
                        {eur(x.balance)}
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Start: <span className="text-white/80 font-semibold">{eur(x.start)}</span></span>
                      <span className={`font-bold ${x.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {x.profit >= 0 ? '+' : ''}{eur(x.profit)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabele - Športi, Tipsterji, Prematch/Live */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <TableCard
            title="Statistika po športih"
            data={sportData}
            icon={<Activity className="w-5 h-5 text-white" />}
          />

          <TableCard
            title="Statistika"
            data={prematchLiveData}
            icon={<BarChart3 className="w-5 h-5 text-white" />}
          />

          <TableCard
            title="Statistika po tipsterjih"
            data={tipsterData}
            icon={<Users className="w-5 h-5 text-white" />}
          />
        </div>

        {/* Grafi */}
        <div className="grid grid-cols-2 gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Profit po mesecih</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMonthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="month" stroke="#fff" fontSize={12} />
                    <YAxis stroke="#fff" fontSize={12} />
                    <Tooltip
                      formatter={(value) => {
                        const n = typeof value === "number" ? value : Number(value);
                        if (!Number.isFinite(n)) return "";
                        return eur(Math.round(n * 100) / 100);
                      }}
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Bar dataKey="profit" fill="url(#colorProfit)" radius={[8, 8, 0, 0]} />
                    <defs>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Kumulativa po mesecih</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartMonthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="month" stroke="#fff" fontSize={12} />
                    <YAxis stroke="#fff" fontSize={12} />
                    <Tooltip
                      formatter={(value) => {
                        const n = typeof value === "number" ? value : Number(value);
                        if (!Number.isFinite(n)) return "";
                        return eur(Math.round(n * 100) / 100);
                      }}
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cum"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}