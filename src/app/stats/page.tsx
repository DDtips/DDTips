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
import { TrendingUp, DollarSign, Target, Trophy, Calendar, Filter, BarChart3, Users, Building2, Clock } from "lucide-react";

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
const STAVNICE = ["SHARP", "PINNACLE", "BET365", "WINAMAX"];

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

  const roi = CAPITAL_TOTAL === 0 ? 0 : profit / CAPITAL_TOTAL;
  const bankroll = CAPITAL_TOTAL + profit;

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

  return { profit, n, wins, losses, avgOdds, roi, bankroll, balanceByBook };
}

function Kpi({ title, value, color = "inherit", icon }: { title: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-yellow-500/10 rounded-2xl blur-lg"></div>
      <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20 hover:border-green-500/40 transition-all hover:scale-105">
        <div className="flex items-center gap-2 text-white/60 text-sm font-semibold mb-2">
          {icon}
          {title}
        </div>
        <div className="text-2xl font-black" style={{ color }}>{value}</div>
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

  const overall = useMemo(() => buildStats(rows), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (sport !== "ALL" && r.sport !== sport) return false;
      if (tipster !== "ALL" && r.tipster !== tipster) return false;
      if (stavnica !== "ALL" && r.stavnica !== stavnica) return false;
      if (cas !== "ALL" && r.cas_stave !== cas) return false;
      if (fromDate && r.datum < fromDate) return false;
      if (toDate && r.datum > toDate) return false;
      return true;
    });
  }, [rows, sport, tipster, stavnica, cas, fromDate, toDate]);

  const filtered = useMemo(() => buildStats(filteredRows), [filteredRows]);

  const chartMonthly = useMemo(() => {
    const settled = filteredRows.filter((r) => r.wl === "WIN" || r.wl === "LOSS");
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
  }, [filteredRows]);

  const chartBySport = useMemo(() => {
    const settled = filteredRows.filter((r) => r.wl === "WIN" || r.wl === "LOSS");
    const map = new Map<string, number>();
    settled.forEach((r) => {
      const key = r.sport || "OSTALO";
      map.set(key, (map.get(key) ?? 0) + calcProfit(r));
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([sport, profit]) => ({ sport, profit }));
  }, [filteredRows]);

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{animationDelay: "1s"}}></div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-black text-white mb-2">Statistika</h1>
            <div className="text-white/60">Upošteva samo WIN/LOSS</div>
          </div>

          <button
            onClick={loadRows}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-yellow-500 text-white font-bold rounded-xl hover:from-green-500 hover:to-yellow-400 transition-all shadow-lg hover:scale-105"
          >
            Osveži
          </button>
        </div>

        {msg && <p className="text-red-400 mb-6">{msg}</p>}

        {/* Skupna statistika */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-yellow-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-white">Skupna statistika</h2>
              <div className="text-white/60">Kapital: {eur(CAPITAL_TOTAL)}</div>
            </div>

            <div className="grid grid-cols-6 gap-4 mb-6">
              <Kpi
                title="Profit"
                value={eur(overall.profit)}
                color={overall.profit >= 0 ? "#22c55e" : "#ef4444"}
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <Kpi
                title="Bankroll"
                value={eur(overall.bankroll)}
                color={overall.bankroll >= CAPITAL_TOTAL ? "#22c55e" : "#ef4444"}
                icon={<DollarSign className="w-4 h-4" />}
              />
              <Kpi
                title="ROI"
                value={`${(overall.roi * 100).toFixed(2)}%`}
                color="#fbbf24"
                icon={<Target className="w-4 h-4" />}
              />
              <Kpi
                title="Stav (WIN/LOSS)"
                value={`${overall.n}`}
                color="#ffffff"
                icon={<BarChart3 className="w-4 h-4" />}
              />
              <Kpi
                title="WIN / LOSS"
                value={`${overall.wins} / ${overall.losses}`}
                color="#10b981"
                icon={<Trophy className="w-4 h-4" />}
              />
              <Kpi
                title="Povp. kvota"
                value={overall.avgOdds ? overall.avgOdds.toFixed(2) : "-"}
                color="#60a5fa"
              />
            </div>

            <div>
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Stanje na stavnicah
              </h3>

              <div className="grid grid-cols-4 gap-4">
                {overall.balanceByBook.map((x) => (
                  <div key={x.name} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-white font-bold">{x.name}</div>
                      <div className={`text-lg font-black ${x.balance >= x.start ? 'text-green-400' : 'text-red-400'}`}>
                        {eur(x.balance)}
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-white/60">
                      <span>Start: {eur(x.start)}</span>
                      <span className={x.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {x.profit >= 0 ? '+' : ''}{eur(x.profit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filtri */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-3 rounded-xl">
                <Filter className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white">Filtri</h2>
            </div>

            <div className="grid grid-cols-6 gap-4">
              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Od (datum)
                </label>
                <input
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  type="date"
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Do (datum)
                </label>
                <input
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  type="date"
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Target className="w-4 h-4 inline mr-1" />
                  Šport
                </label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400 transition-all"
                >
                  <option value="ALL">ALL</option>
                  {SPORTI.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Tipster
                </label>
                <select
                  value={tipster}
                  onChange={(e) => setTipster(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400 transition-all"
                >
                  <option value="ALL">ALL</option>
                  {TIPSTERJI.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Stavnica
                </label>
                <select
                  value={stavnica}
                  onChange={(e) => setStavnica(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400 transition-all"
                >
                  <option value="ALL">ALL</option>
                  {STAVNICE.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Prematch/Live
                </label>
                <select
                  value={cas}
                  onChange={(e) => setCas(e.target.value as any)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400 transition-all"
                >
                  <option value="ALL">ALL</option>
                  <option value="PREMATCH">PREMATCH</option>
                  <option value="LIVE">LIVE</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => {
                  setSport("ALL");
                  setTipster("ALL");
                  setStavnica("ALL");
                  setCas("ALL");
                  setFromDate("");
                  setToDate("");
                }}
                className="px-6 py-3 bg-white/10 border-2 border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-all"
              >
                Počisti filtre
              </button>
            </div>
          </div>
        </div>

        {/* Statistika po filtrih */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-yellow-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-6">Statistika po filtrih</h2>

            <div className="grid grid-cols-6 gap-4">
              <Kpi
                title="Profit"
                value={eur(filtered.profit)}
                color={filtered.profit >= 0 ? "#22c55e" : "#ef4444"}
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <Kpi
                title="Stav"
                value={`${filtered.n}`}
                color="#ffffff"
                icon={<BarChart3 className="w-4 h-4" />}
              />
              <Kpi
                title="WIN"
                value={`${filtered.wins}`}
                color="#22c55e"
                icon={<Trophy className="w-4 h-4" />}
              />
              <Kpi
                title="LOSS"
                value={`${filtered.losses}`}
                color="#ef4444"
              />
              <Kpi
                title="Povp. kvota"
                value={filtered.avgOdds ? filtered.avgOdds.toFixed(2) : "-"}
                color="#60a5fa"
              />
              <Kpi
                title="ROI"
                value={`${(filtered.roi * 100).toFixed(2)}%`}
                color="#fbbf24"
                icon={<Target className="w-4 h-4" />}
              />
            </div>
          </div>
        </div>

        {/* Grafi */}
        <div className="grid grid-cols-2 gap-6 mb-8">
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

        {/* Profit po športih */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Profit po športih</h3>
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartBySport} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" stroke="#fff" fontSize={12} />
                  <YAxis type="category" dataKey="sport" width={120} stroke="#fff" fontSize={12} />
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
                  <Bar dataKey="profit" fill="url(#colorSport)" radius={[0, 8, 8, 0]} />
                  <defs>
                    <linearGradient id="colorSport" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}