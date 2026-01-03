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
  Activity,
  Zap,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calendar,
  Layers,
} from "lucide-react";

// --- TYPES & HELPERS ---
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

function hasLay(b: Bet) { return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0; }
function hasBack(b: Bet) { return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0; }
function eur(n: number) { return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR" }); }

function calcProfit(b: Bet): number {
  const kom = b.komisija || 0;
  if (b.wl !== "WIN" && b.wl !== "LOSS") return 0;
  const backStake = b.vplacilo1 || 0;
  const backOdds = b.kvota1 || 0;
  const layStake = b.vplacilo2 || 0;
  const layOdds = b.lay_kvota || 0;
  const layLiability = (layOdds - 1) * layStake;

  if (!hasBack(b) && hasLay(b)) return b.wl === "WIN" ? layStake - kom : -layLiability - kom;
  if (hasBack(b) && !hasLay(b)) return b.wl === "WIN" ? backStake * (backOdds - 1) - kom : -backStake - kom;
  if (hasBack(b) && hasLay(b)) {
    return b.wl === "WIN" ? backStake * (backOdds - 1) - layLiability - kom : -backStake + layStake - kom;
  }
  return 0;
}

function buildStats(rows: Bet[]) {
  const settled = rows.filter((r) => r.wl === "WIN" || r.wl === "LOSS");
  const profit = settled.reduce((acc, r) => acc + calcProfit(r), 0);
  const bankroll = CAPITAL_TOTAL + profit;
  const wins = settled.filter((r) => r.wl === "WIN").length;
  const n = settled.length;
  const winRate = n > 0 ? (wins / n) * 100 : 0;
  const donosNaKapital = ((bankroll - CAPITAL_TOTAL) / CAPITAL_TOTAL) * 100;

  return { profit, bankroll, wins, losses: n - wins, n, winRate, donosNaKapital };
}

// --- COMPONENTS ---
function MetricCard({ title, value, subValue, trend, icon: Icon, color = "emerald" }: any) {
  const colors: any = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900/50 border border-zinc-800 p-5 backdrop-blur-sm hover:border-zinc-700 transition-all duration-300 group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${colors[color]} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800 ${trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            Trend
          </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
        <div className="text-2xl md:text-3xl font-bold text-white tracking-tight">{value}</div>
        {subValue && <p className="text-xs text-zinc-400 font-medium">{subValue}</p>}
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.push("/login");
      const { data: bets } = await supabase.from("bets").select("*").order("datum", { ascending: true });
      setRows((bets ?? []) as Bet[]);
      setLoading(false);
    })();
  }, [router]);

  const stats = useMemo(() => buildStats(rows), [rows]);

  // Chart Logic (Cumulative Profit)
  const chartData = useMemo(() => {
    const settled = rows.filter(r => r.wl === "WIN" || r.wl === "LOSS").sort((a,b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());
    let running = 0;
    return settled.map(r => {
      running += calcProfit(r);
      return { date: new Date(r.datum).toLocaleDateString("sl-SI", {day:"2-digit", month:"2-digit"}), profit: running };
    });
  }, [rows]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-emerald-500 animate-pulse">Nalaganje...</div>;

  return (
    <main className="min-h-screen pt-24 pb-12 px-4 md:px-8 bg-black">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-black to-black pointer-events-none" />
      
      <div className="relative max-w-[1600px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-zinc-800/50 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Pregled Stanja</h1>
            <p className="text-zinc-400 text-sm">Dobrodošli nazaj. Tukaj je vaš trenutni finančni pregled.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
              Posodobljeno: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="Trenutni Profit" 
            value={eur(stats.profit)} 
            subValue={`Začetni kapital: ${eur(CAPITAL_TOTAL)}`}
            trend={stats.profit >= 0 ? "up" : "down"}
            icon={TrendingUp}
            color={stats.profit >= 0 ? "emerald" : "rose"}
          />
          <MetricCard 
            title="Skupna Banka" 
            value={eur(stats.bankroll)} 
            subValue={`Donos: ${stats.donosNaKapital.toFixed(2)}%`}
            icon={Wallet}
            color="violet"
          />
          <MetricCard 
            title="Število Stav" 
            value={stats.n} 
            subValue={`${stats.wins} Zmag / ${stats.losses} Porazov`}
            icon={Layers}
            color="sky"
          />
          <MetricCard 
            title="Win Rate" 
            value={`${stats.winRate.toFixed(1)}%`} 
            subValue="Odstotek dobljenih stav"
            icon={Activity}
            color="amber"
          />
        </div>

        {/* Main Chart Section */}
        <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/50 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><Activity className="w-5 h-5"/></div>
              <h3 className="font-bold text-white">Rast Profita (YTD)</h3>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} minTickGap={50} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(val: number) => [eur(val), "Profit"]}
                />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fill="url(#grad)" activeDot={{r: 6, fill: "#fff"}} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </main>
  );
}