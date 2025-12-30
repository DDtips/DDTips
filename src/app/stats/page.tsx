"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { TrendingUp, DollarSign, Target, Trophy, Calendar, Filter, BarChart3, Users, Building2, Clock, TrendingDown } from "lucide-react";

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

  // Filter states
  const [sport, setSport] = useState("ALL");
  const [tipster, setTipster] = useState("ALL");
  const [stavnica, setStavnica] = useState("ALL");
  const [cas, setCas] = useState<"ALL" | Cas>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [oddsFilter, setOddsFilter] = useState<"ALL" | "OVER" | "UNDER">("ALL");
  const [oddsValue, setOddsValue] = useState("2");

  // Applied filters (after clicking "Potrdi")
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
      
      // Odds filter
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
        <div className="text-center mb-12">
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-gradient-to-r from-green-500/40 via-yellow-500/40 to-green-500/40 blur-3xl animate-pulse"></div>
            <h1 className="relative text-7xl font-black bg-gradient-to-r from-green-400 via-yellow-300 to-green-400 bg-clip-text text-transparent mb-3 tracking-tight">
              STATISTIKA
            </h1>
          </div>
        </div>

        {msg && <p className="text-red-400 mb-6 text-center">{msg}</p>}

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

            <div className="grid grid-cols-4 gap-4 mb-4">
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

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <TrendingUp className="w-4 h-4 inline mr-1" />
                  Kvota
                </label>
                <select
                  value={oddsFilter}
                  onChange={(e) => setOddsFilter(e.target.value as any)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400 transition-all"
                >
                  <option value="ALL">ALL</option>
                  <option value="OVER">OVER</option>
                  <option value="UNDER">UNDER</option>
                </select>
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <TrendingDown className="w-4 h-4 inline mr-1" />
                  Vrednost kvote
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={oddsValue}
                  onChange={(e) => setOddsValue(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400 transition-all"
                  placeholder="2.0"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleApplyFilters}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold rounded-xl hover:from-green-500 hover:to-emerald-400 transition-all shadow-lg hover:scale-105"
              >
                Potrdi
              </button>
              
              <button
                onClick={handleClearFilters}
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



        {/* Stolpci - Tipsterji */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-red-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-6 h-6 text-orange-400" />
              <h3 className="text-2xl font-bold text-white">Statistika po tipsterjih</h3>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              {statsByTipster.map((stat) => (
                <div key={stat.name} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all">
                  <div className="text-orange-400 font-black text-lg mb-3">{stat.name}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Profit:</span>
                      <span className={`font-bold ${stat.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {eur(stat.profit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Stav:</span>
                      <span className="text-white font-semibold">{stat.n}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">WIN/LOSS:</span>
                      <span className="text-white font-semibold">{stat.wins}/{stat.losses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Povp. kvota:</span>
                      <span className="text-blue-400 font-semibold">{stat.avgOdds.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">ROI:</span>
                      <span className={`font-bold ${stat.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(stat.roi * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stolpci - Športi */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/20 to-blue-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Target className="w-6 h-6 text-cyan-400" />
              <h3 className="text-2xl font-bold text-white">Statistika po športih</h3>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              {statsBySport.map((stat) => (
                <div key={stat.name} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all">
                  <div className="text-cyan-400 font-black text-lg mb-3">{stat.name}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Profit:</span>
                      <span className={`font-bold ${stat.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {eur(stat.profit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Stav:</span>
                      <span className="text-white font-semibold">{stat.n}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">WIN/LOSS:</span>
                      <span className="text-white font-semibold">{stat.wins}/{stat.losses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Povp. kvota:</span>
                      <span className="text-blue-400 font-semibold">{stat.avgOdds.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">ROI:</span>
                      <span className={`font-bold ${stat.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(stat.roi * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stolpci - Prematch/Live */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-violet-400" />
              <h3 className="text-2xl font-bold text-white">Statistika po času stave</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {statsByCas.map((stat) => (
                <div key={stat.name} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all">
                  <div className="text-violet-400 font-black text-lg mb-3">{stat.name}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Profit:</span>
                      <span className={`font-bold ${stat.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {eur(stat.profit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Stav:</span>
                      <span className="text-white font-semibold">{stat.n}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">WIN/LOSS:</span>
                      <span className="text-white font-semibold">{stat.wins}/{stat.losses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Povp. kvota:</span>
                      <span className="text-blue-400 font-semibold">{stat.avgOdds.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">ROI:</span>
                      <span className={`font-bold ${stat.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(stat.roi * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}