"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
  Legend,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  Activity,
  Zap,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PieChart as PieIcon,
  Hash,
  Trophy,
  CalendarDays,
  Users,
  Sparkles,
} from "lucide-react";

// --- TIPOVI IN KONSTANTE ---
type WL = "OPEN" | "WIN" | "LOSS" | "VOID" | "BACK WIN" | "LAY WIN";

type Bet = {
  id: string; datum: string; wl: WL; kvota1: number; vplacilo1: number; lay_kvota: number;
  vplacilo2: number; komisija: number; sport: string; cas_stave: string;
  tipster: string; stavnica: string; mode?: "BET" | "TRADING" | null;
};

const CAPITAL_TOTAL = 8500;
const BOOK_START: Record<string, number> = {
  SHARP: 1500, PINNACLE: 2000, BET365: 2000, WINAMAX: 1000, WWIN: 500, "E-STAVE": 500, "BET AT HOME": 1000,
};

const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"];
const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"];
const PIE_COLORS = ["#22d3ee", "#a78bfa", "#fbbf24", "#34d399", "#f472b6", "#60a5fa", "#94a3b8"];

// --- POMOŽNE FUNKCIJE ---
function normBook(x: string) { return (x || "").toUpperCase().replace(/\s+/g, "").replace(/-/g, ""); }
function eur(n: number | undefined | null) { 
  const val = n ?? 0;
  return val.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }); 
}
function eurDec(n: number | undefined | null) { 
  const val = n ?? 0;
  return val.toLocaleString("sl-SI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}
function hasLay(b: Bet) { return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0; }
function hasBack(b: Bet) { return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0; }

function calcProfit(b: Bet): number {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;
  const komZnesek = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0; const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0; const layOdds = b.lay_kvota || 0;
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;
  let brutoProfit = 0;
  if (hasBack(b) && hasLay(b)) {
    const profitIfBackWins = (backStake * (backOdds - 1)) - layLiability;
    const profitIfLayWins = layStake - backStake;
    if (b.wl === "BACK WIN") brutoProfit = profitIfBackWins; else if (b.wl === "LAY WIN") brutoProfit = profitIfLayWins; else if (b.wl === "WIN") brutoProfit = Math.max(profitIfBackWins, profitIfLayWins); else if (b.wl === "LOSS") brutoProfit = Math.min(profitIfBackWins, profitIfLayWins);
  } else if (!hasBack(b) && hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") brutoProfit = layStake; else if (b.wl === "LOSS" || b.wl === "BACK WIN") brutoProfit = -layLiability;
  } else if (hasBack(b) && !hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") brutoProfit = backStake * (backOdds - 1); else if (b.wl === "LOSS" || b.wl === "LAY WIN") brutoProfit = -backStake;
  }
  if (brutoProfit > 0) return brutoProfit - komZnesek;
  return brutoProfit;
}

function calcRisk(b: Bet): number {
    const hasBackBet = hasBack(b);
    const hasLayBet = hasLay(b);
    const backStake = b.vplacilo1 || 0;
    const layLiability = b.vplacilo2 || 0;
    if (hasBackBet && !hasLayBet) return backStake;
    if (!hasBackBet && hasLayBet) return layLiability;
    if (hasBackBet && hasLayBet) return Math.max(backStake, layLiability);
    return 0;
}

function buildStats(rows: Bet[]) {
  const settled = rows.filter((r) => r.wl !== "OPEN" && r.wl !== "VOID");
  const n = settled.length;
  const wins = settled.filter((r) => r.wl === "WIN" || r.wl === "BACK WIN" || r.wl === "LAY WIN").length;
  const losses = settled.filter((r) => r.wl === "LOSS").length;
  const profit = settled.reduce((acc, r) => acc + calcProfit(r), 0);
  const bankroll = CAPITAL_TOTAL + profit;
  const donosNaKapital = ((bankroll - CAPITAL_TOTAL) / CAPITAL_TOTAL) * 100;
  const winRate = n > 0 ? (wins / n) * 100 : 0;

  const profitByBook = new Map<string, number>();
  settled.forEach((r) => { const key = normBook(r.stavnica || "NEZNANO"); profitByBook.set(key, (profitByBook.get(key) ?? 0) + calcProfit(r)); });
  const balanceByBook: { name: string; start: number; profit: number; balance: number }[] = [];
  Object.entries(BOOK_START).forEach(([name, start]) => { const normalizedName = normBook(name); const p = profitByBook.get(normalizedName) ?? 0; balanceByBook.push({ name, start, profit: p, balance: start + p }); });
  balanceByBook.sort((a, b) => b.balance - a.balance);

  const profitBySport = new Map<string, number>();
  SPORTI.forEach((sport) => profitBySport.set(sport, 0));
  settled.forEach((r) => { const key = r.sport || "OSTALO"; profitBySport.set(key, (profitBySport.get(key) ?? 0) + calcProfit(r)); });
  const profitByTipster = new Map<string, number>();
  TIPSTERJI.forEach((tipster) => profitByTipster.set(tipster, 0));
  settled.forEach((r) => { const key = r.tipster || "NEZNANO"; profitByTipster.set(key, (profitByTipster.get(key) ?? 0) + calcProfit(r)); });
  
  const prematch = settled.filter((r) => r.cas_stave === "PREMATCH");
  const live = settled.filter((r) => r.cas_stave === "LIVE");
  
  const prematchCount = prematch.length;
  const liveCount = live.length;
  const profitPrematch = prematch.reduce((acc, r) => acc + calcProfit(r), 0);
  const profitLive = live.reduce((acc, r) => acc + calcProfit(r), 0);

  return { profit, bankroll, donosNaKapital, n, wins, losses, winRate, balanceByBook, profitBySport, profitByTipster, prematchCount, liveCount, profitPrematch, profitLive };
}

// --- KOMPONENTE UI ---

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0];
    const value = dataPoint.value;
    const title = dataPoint.name || label;
    const isProfitChart = dataPoint.name === 'profit' || title === 'Profit';
    
    return (
      <div className="tooltip-glass">
        <p className="tooltip-label">{title}</p>
        <div className="tooltip-row">
          <span className="tooltip-key">{isProfitChart ? "Profit:" : "Volume:"}</span>
          <span className={`tooltip-value ${isProfitChart ? (value >= 0 ? 'positive' : 'negative') : ''}`}>
            {isProfitChart && value > 0 ? "+" : ""}{eurDec(value)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

function MetricCard({ title, value, subtitle, trend, icon, variant = "default" }: any) {
  const variants: Record<string, { border: string; glow: string; text: string }> = {
    default: { border: "border-zinc-800/50", glow: "", text: "text-zinc-100" },
    success: { border: "border-cyan-500/20", glow: "glow-cyan", text: "text-cyan-400" },
    danger: { border: "border-rose-500/20", glow: "glow-rose", text: "text-rose-400" },
    warning: { border: "border-amber-500/20", glow: "glow-amber", text: "text-amber-400" },
    info: { border: "border-violet-500/20", glow: "glow-violet", text: "text-violet-400" },
  };
  
  const v = variants[variant] || variants.default;

  return (
    <div className={`metric-card ${v.border} ${v.glow}`}>
      <div className="metric-header">
        <div className={`metric-icon ${v.text}`}>{icon}</div>
        <span className="metric-title">{title}</span>
      </div>
      <div className="metric-body">
        <span className={`metric-value ${v.text}`}>{value}</span>
        {trend && trend !== "neutral" && (
          <div className={`metric-trend ${trend === "up" ? "trend-up" : "trend-down"}`}>
            {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          </div>
        )}
      </div>
      {subtitle && <p className="metric-subtitle">{subtitle}</p>}
    </div>
  );
}

function StatBadge({ label, value, icon, colorClass }: any) {
  return (
    <div className="stat-badge">
      <div className={`stat-badge-icon ${colorClass}`}>{icon}</div>
      <div className="stat-badge-content">
        <span className="stat-badge-label">{label}</span>
        <span className={`stat-badge-value ${colorClass}`}>{value}</span>
      </div>
    </div>
  );
}

function DataTable({ title, data, icon }: any) {
  const maxProfit = Math.max(...(data || []).map((d:any) => Math.abs(d.profit)));
  
  return (
    <div className="data-table">
      <div className="data-table-header">
        <div className="data-table-icon">{icon}</div>
        <h3 className="data-table-title">{title}</h3>
      </div>
      <div className="data-table-body">
        {data.map((item:any, idx:number) => {
          const barWidth = maxProfit > 0 ? (Math.abs(item.profit) / maxProfit) * 100 : 0;
          const isPositive = item.profit >= 0;
          return (
            <div key={idx} className="data-table-row">
              <div 
                className={`data-table-bar ${isPositive ? "bar-positive" : "bar-negative"}`} 
                style={{ width: `${barWidth}%` }} 
              />
              
              <div className="row-content">
                  <span className="data-table-label">{item.label}</span>
                  <span className={`data-table-value ${isPositive ? "text-cyan-400" : "text-rose-400"}`}>
                    {item.value}
                  </span>
              </div>
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
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Stanje za citat
  const [quote, setQuote] = useState({ text: "Uspeh je v podrobnostih.", author: "Neznan" });

  useEffect(() => {
    setMounted(true);
    
    const fetchQuote = async () => {
      try {
        const res = await fetch("https://zenquotes.io/api/random");
        const data = await res.json();
        if (data && data[0]) {
          setQuote({ text: data[0].q, author: data[0].a });
        }
      } catch (err) {
        console.error("Napaka pri pridobivanju citata:", err);
      }
    };

    const checkUserAndLoad = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', user.id)
        .single();

      if (profileError || !profile || !profile.is_approved) {
        router.replace("/pending");
        return;
      }
      await loadRows();
      setLoading(false);
    };

    fetchQuote();
    checkUserAndLoad();
  }, [router]);

  async function loadRows() {
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: true });
    if (!error) {
        setRows((data ?? []) as Bet[]);
    }
  }

  const stats = useMemo(() => buildStats(rows), [rows]);

  const chartDaily = useMemo(() => {
    const now = new Date(); const currentYear = now.getFullYear(); const currentMonth = now.getMonth();
    const settled = rows.filter((r) => { if (r.wl === "OPEN" || r.wl === "VOID") return false; const d = new Date(r.datum); return d.getFullYear() === currentYear && d.getMonth() === currentMonth; });
    const map = new Map<number, number>();
    settled.forEach((r) => { const day = new Date(r.datum).getDate(); map.set(day, (map.get(day) ?? 0) + calcProfit(r)); });
    let cumulative = 0; const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate(); const arr: any[] = [];
    for (let d = 1; d <= daysInMonth; d++) { const daily = map.get(d) ?? 0; cumulative += daily; if (d <= now.getDate() || now.getMonth() !== currentMonth) arr.push({ day: d, dayLabel: `${d}.`, profit: cumulative }); }
    return arr;
  }, [rows]);

  const chartMonthly = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const settled = rows.filter((r) => { if (r.wl === "OPEN" || r.wl === "VOID") return false; const d = new Date(r.datum); return d.getFullYear() === currentYear; });
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];
    const monthProfit = new Map<number, number>();
    for(let i=0; i<12; i++) monthProfit.set(i, 0);
    settled.forEach((r) => { const month = new Date(r.datum).getMonth(); monthProfit.set(month, (monthProfit.get(month) ?? 0) + calcProfit(r)); });
    return monthNames.map((name, idx) => { return { monthName: name, profit: monthProfit.get(idx) ?? 0 }; });
  }, [rows]);

  const pieData = useMemo(() => {
    const sportVolume = new Map<string, number>();
    let totalRisk = 0;
    rows.forEach((r) => { 
        const risk = calcRisk(r); 
        totalRisk += risk;
        const sport = r.sport || "OSTALO"; 
        sportVolume.set(sport, (sportVolume.get(sport) || 0) + risk); 
    });
    
    const data = Array.from(sportVolume.entries()).map(([name, value]) => ({ 
        name, 
        value,
        percent: totalRisk > 0 ? (value / totalRisk) * 100 : 0
    }));
    data.sort((a, b) => b.value - a.value);
    return data;
  }, [rows]);

  const currentMonthName = new Date().toLocaleDateString("sl-SI", { month: "long", year: "numeric" });
  const sportData = useMemo(() => SPORTI.map((s) => ({ label: s, value: eur(stats.profitBySport.get(s) ?? 0), profit: stats.profitBySport.get(s) ?? 0 })).sort((a, b) => b.profit - a.profit), [stats]);
  const tipsterData = useMemo(() => TIPSTERJI.map((t) => ({ label: t, value: eur(stats.profitByTipster.get(t) ?? 0), profit: stats.profitByTipster.get(t) ?? 0 })).sort((a, b) => b.profit - a.profit), [stats]);
  
  const timingData = useMemo(() => [
      { label: `Prematch (${stats.prematchCount})`, value: eur(stats.profitPrematch), profit: stats.profitPrematch }, 
      { label: `Live (${stats.liveCount})`, value: eur(stats.profitLive), profit: stats.profitLive }
  ], [stats]);
  
  const skupnaBanka = stats.balanceByBook.reduce((a, b) => a + b.balance, 0);
  const diffFromStart = skupnaBanka - CAPITAL_TOTAL;
  const isProfit = diffFromStart >= 0;

  const maxBalance = Math.max(...stats.balanceByBook.map(b => b.balance), 1);

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p className="loading-text">Nalaganje podatkov...</p>
    </div>
  );

  return (
    <main className="dashboard">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        
        :root {
          --font-display: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
          --font-mono: 'DM Mono', 'SF Mono', monospace;
          --bg-primary: #0a0a0b;
          --bg-card: rgba(255, 255, 255, 0.02);
          --bg-card-hover: rgba(255, 255, 255, 0.04);
          --border-subtle: rgba(255, 255, 255, 0.06);
          --border-medium: rgba(255, 255, 255, 0.1);
          --text-primary: #fafafa;
          --text-secondary: #a1a1aa;
          --text-muted: #52525b;
          --cyan: #22d3ee;
          --rose: #fb7185;
          --amber: #fbbf24;
          --violet: #a78bfa;
          --emerald: #34d399;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: var(--font-display);
          background: var(--bg-primary);
          color: var(--text-primary);
          -webkit-font-smoothing: antialiased;
        }
        
        .dashboard {
          min-height: 100vh;
          background: var(--bg-primary);
          position: relative;
          overflow-x: hidden;
        }
        
        .dashboard::before {
          content: '';
          position: fixed;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: 
            radial-gradient(ellipse at 20% 20%, rgba(34, 211, 238, 0.03) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(167, 139, 250, 0.03) 0%, transparent 50%);
          pointer-events: none;
        }

        .dashboard-content {
          position: relative;
          z-index: 1;
          max-width: 1600px;
          margin: 0 auto;
          padding: 170px 24px 40px 24px;
        }

        @media (min-width: 768px) {
          .dashboard-content { padding: 180px 40px 60px 40px; }
        }

/* --- ANIMIRAN CITAT (MARQUEE) --- */
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.quote-header {
  margin-bottom: 32px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  position: relative;
  width: 100%;
  overflow: hidden;
}

.quote-marquee-wrapper {
  display: flex;
  align-items: center;
  white-space: nowrap;
  animation: marquee 20s linear infinite;
  width: fit-content;
}

.quote-marquee-wrapper:hover {
  animation-play-state: paused;
}

.quote-content {
  display: flex;
  align-items: center;
  padding-right: 100px;
}

        .quote-tag {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--cyan);
          display: flex;
          align-items: center;
          gap: 6px;
          margin-right: 6px;
          flex-shrink: 0;
        }

        .quote-text {
          font-size: 15px;
          font-weight: 400;
          color: var(--text-primary);
          font-style: italic;
          opacity: 0.95;
          margin: 0;
          display: inline;
          flex-shrink: 0;
        }

        .quote-author {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          margin-left: 6px;
          flex-shrink: 0;
        }
        
        /* Metric Cards */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        
        @media (min-width: 768px) {
          .metrics-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
          }
        }
        
        .metric-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          padding: 16px;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }
        
        .metric-card:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-medium);
          transform: translateY(-2px);
        }
        
        .metric-card.glow-cyan::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, var(--cyan), transparent);
          opacity: 0.5;
        }
        
        .metric-card.glow-rose::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, var(--rose), transparent);
          opacity: 0.5;
        }

        .metric-card.glow-amber::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, var(--amber), transparent);
          opacity: 0.5;
        }
        
        .metric-card.glow-violet::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, var(--violet), transparent);
          opacity: 0.5;
        }
        
        .metric-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        
        .metric-icon svg { width: 14px; height: 14px; opacity: 0.7; }
        
        .metric-title {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }
        
        .metric-body { display: flex; align-items: center; gap: 8px; }
        
        .metric-value {
          font-family: var(--font-mono);
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.02em;
        }
        
        @media (min-width: 768px) { .metric-value { font-size: 26px; } }
        
        .metric-trend {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 5px;
        }
        
        .metric-trend.trend-up { background: rgba(34, 211, 238, 0.15); color: var(--cyan); }
        .metric-trend.trend-down { background: rgba(251, 113, 133, 0.15); color: var(--rose); }
        
        .metric-subtitle { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
        
        .stats-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 24px;
        }
        
        @media (min-width: 768px) { .stats-row { grid-template-columns: repeat(4, 1fr); gap: 12px; } }
        
        .stat-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          padding: 12px 14px;
        }
        
        .stat-badge-content { display: flex; flex-direction: column; gap: 2px; }
        .stat-badge-label { font-size: 9px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); }
        .stat-badge-value { font-family: var(--font-mono); font-size: 15px; font-weight: 500; }
        
        .main-grid { display: grid; gap: 16px; margin-bottom: 24px; }
        @media (min-width: 1200px) { .main-grid { grid-template-columns: 1fr 340px; gap: 20px; } }
        
        .chart-card { background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 20px; }
        .chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .chart-title { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }
        .chart-value { font-family: var(--font-mono); font-size: 14px; font-weight: 500; padding: 5px 10px; background: rgba(255, 255, 255, 0.03); border-radius: 6px; }
        .chart-container { height: 220px; width: 100%; }

        /* Wallet */
        .wallet-card { background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 16px; overflow: hidden; height: 100%; display: flex; flex-direction: column; }
        .wallet-header { padding: 16px 18px; border-bottom: 1px solid var(--border-subtle); background: rgba(0, 0, 0, 0.2); }
        .wallet-amount { font-family: var(--font-mono); font-size: 26px; font-weight: 500; }
        
        .wallet-list { padding: 12px; display: flex; flex-direction: column; gap: 6px; flex: 1; overflow-y: auto; }
        
        .wallet-item { 
          display: flex; 
          align-items: center; 
          position: relative; 
          padding: 8px 12px;
          border-radius: 8px;
          overflow: hidden;
          background: rgba(255,255,255,0.01);
          min-height: 42px;
        }

        .wallet-bar {
          position: absolute; 
          left: 0; 
          top: 0; 
          bottom: 0; 
          opacity: 0.15;
          z-index: 0;
          transition: width 0.5s ease;
        }
        
        .wallet-content-row {
          display: flex; 
          justify-content: space-between; 
          width: 100%; 
          z-index: 1;
          align-items: center;
          font-size: 11px; 
          font-weight: 500; 
          color: var(--text-secondary);
        }

        .bg-cyan { background: var(--cyan); border-right: 1px solid var(--cyan); }
        .bg-rose { background: var(--rose); border-right: 1px solid var(--rose); }

        /* Data Tables */
        .tables-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 768px) { .tables-grid { grid-template-columns: repeat(3, 1fr); } }

        .data-table { background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 14px; }
        .data-table-header { padding: 14px 16px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 8px; }
        .data-table-body { padding: 12px; display: flex; flex-direction: column; gap: 6px; }
        
        .data-table-row { 
          display: flex; 
          align-items: center; 
          position: relative; 
          padding: 8px 12px;
          border-radius: 8px;
          overflow: hidden;
          background: rgba(255,255,255,0.01);
        }
        
        .data-table-bar { 
          position: absolute; 
          left: 0; 
          top: 0; 
          bottom: 0; 
          opacity: 0.15; 
          z-index: 0;
          transition: width 0.5s ease;
        }
        .bar-positive { background: var(--cyan); border-right: 1px solid var(--cyan); }
        .bar-negative { background: var(--rose); border-right: 1px solid var(--rose); }

        .row-content {
          display: flex; 
          justify-content: space-between; 
          width: 100%; 
          z-index: 1;
          align-items: center;
        }

        .data-table-label { font-size: 11px; font-weight: 500; color: var(--text-secondary); }
        .data-table-value { font-family: var(--font-mono); font-size: 12px; font-weight: 600; }

        .tooltip-glass { background: rgba(10, 10, 11, 0.95); border: 1px solid var(--border-medium); border-radius: 8px; padding: 10px 14px; }
        .tooltip-value.positive { color: var(--cyan); }
        .tooltip-value.negative { color: var(--rose); }

        .loading-screen { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-primary); gap: 16px; }
        .loading-spinner { width: 32px; height: 32px; border: 2px solid var(--border-subtle); border-top-color: var(--cyan); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .text-cyan-400 { color: var(--cyan); }
        .text-rose-400 { color: var(--rose); }
      `}</style>

      <div className="dashboard-content">
        
        {/* AVTOMATSKI MOTIVACIJSKI CITAT - ANIMIRAN VODORAVNO */}
<header className="quote-header">
  <div className="quote-marquee-wrapper">
    <div className="quote-content">
      <div className="quote-tag">
        <Sparkles className="w-3 h-3" /> Misel dneva :
      </div>
      <p className="quote-text">
        "{quote.text}"
      </p>
      <div className="quote-author">
        — {quote.author}
      </div>
    </div>
    <div className="quote-content">
      <div className="quote-tag">
        <Sparkles className="w-3 h-3" /> Misel dneva :
      </div>
      <p className="quote-text">
        "{quote.text}"
      </p>
      <div className="quote-author">
        — {quote.author}
      </div>
    </div>
  </div>
</header>

        {/* KPI Kartice */}
        <section className="metrics-grid">
          <MetricCard 
            title="Začetni kapital" 
            value={eur(CAPITAL_TOTAL)} 
            icon={<DollarSign />} 
            variant="info"
          />
          <MetricCard 
            title="Trenutno stanje" 
            value={eur(stats.bankroll)} 
            trend={stats.bankroll >= CAPITAL_TOTAL ? "up" : "down"} 
            icon={<Wallet />} 
            variant={stats.bankroll >= CAPITAL_TOTAL ? "success" : "danger"}
          />
          <MetricCard 
            title="Celoten profit" 
            value={eur(stats.profit)} 
            trend={stats.profit >= 0 ? "up" : "down"} 
            icon={<TrendingUp />} 
            variant={stats.profit >= 0 ? "success" : "danger"}
          />
          <MetricCard 
            title="Donos" 
            value={`${stats.donosNaKapital.toFixed(1)}%`} 
            trend={stats.donosNaKapital >= 0 ? "up" : "down"} 
            icon={<BarChart3 />} 
            variant="warning"
          />
        </section>

        {/* Stat Badges */}
        <section className="stats-row">
          <StatBadge label="Stave" value={stats.n} icon={<Hash />} colorClass="text-zinc-100" />
          <StatBadge label="Zmage" value={stats.wins} icon={<Trophy />} colorClass="text-cyan-400" />
          <StatBadge label="Porazi" value={stats.losses} icon={<ArrowDownRight />} colorClass="text-rose-400" />
          <StatBadge label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} icon={<Zap />} colorClass="text-violet-400" />
        </section>

        {/* Glavni Grid */}
        <section className="main-grid">
          <div className="charts-column" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title"><Clock /> Dnevni Profit</h3>
                <span className={`chart-value ${stats.profit >= 0 ? "text-cyan-400" : "text-rose-400"}`}>{eur(stats.profit)}</span>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDaily}>
                    <defs>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="dayLabel" stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} width={45} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="profit" stroke="#22d3ee" strokeWidth={2} fill="url(#colorProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div className="chart-card">
                <h3 className="chart-title" style={{ marginBottom: '16px' }}><CalendarDays /> Mesečni Profit</h3>
                <div style={{ height: '160px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartMonthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="monthName" stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} width={40} />
                      <Bar dataKey="profit">
                        <LabelList 
                          dataKey="profit" 
                          position="top" 
                          style={{ fill: '#a1a1aa', fontSize: '10px', fontWeight: 500 }} 
                          formatter={(val: number) => eur(val)} 
                        />
                        {chartMonthly.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#22d3ee" : "#fb7185"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-card">
                <h3 className="chart-title" style={{ marginBottom: '16px' }}><PieIcon /> Porazdelitev</h3>
                <div style={{ height: '160px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      {/* SPREMENJENO: Povečan notranji in zunanji radij za večji krog in luknjo */}
                      <Pie data={pieData} innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value" stroke="none">
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      {/* SPREMENJENO: Še večja legenda */}
                      <Legend 
                        layout="vertical" 
                        verticalAlign="middle" 
                        align="right"
                        iconSize={16}
                        wrapperStyle={{ fontSize: '14px', color: '#a1a1aa' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <div className="wallet-card">
            <div className="wallet-header">
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Skupna banka</div>
              <div className="wallet-amount" style={{ color: isProfit ? 'var(--cyan)' : 'var(--rose)' }}>{eur(skupnaBanka)}</div>
            </div>
            
            <div className="wallet-list">
              {stats.balanceByBook.map((book) => {
                 const width = (book.balance / maxBalance) * 100;
                 const isProfit = book.balance >= book.start;
                 return (
                   <div key={book.name} className="wallet-item">
                     {/* Background Bar */}
                     <div 
                        className={`wallet-bar ${isProfit ? 'bg-cyan' : 'bg-rose'}`} 
                        style={{ width: `${width}%` }} 
                     />
                     
                     <div className="wallet-content-row">
                        <span style={{ fontWeight: 500 }}>{book.name}</span>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                           <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: '#fafafa' }}>
                             {eur(book.balance)}
                           </span>
                           <span style={{ fontSize: '10px', color: isProfit ? 'var(--cyan)' : 'var(--rose)' }}>
                             {isProfit ? '+' : ''}{eur(book.profit)}
                           </span>
                        </div>
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>
        </section>

        <section className="tables-grid">
          <DataTable title="Po športih" data={sportData} icon={<Activity className="text-cyan-400" />} />
          <DataTable title="Po tipsterjih" data={tipsterData} icon={<Users className="text-violet-400" />} />
          <DataTable title="Po času" data={timingData} icon={<Clock className="text-amber-400" />} />
        </section>

        <footer style={{ marginTop: '32px', padding: '20px 0', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>© 2026 DDTips Analytics</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>API Integrated Quote System</span>
        </footer>
      </div>
    </main>
  );
}