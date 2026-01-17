"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, Trophy, Users, Activity, RefreshCw,
  Target, Flame, Crown, ChevronDown,
  Loader2, Zap, Star, CalendarDays, CalendarRange, Award, X
} from "lucide-react";

// --- TIPOVI ---
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
  mode?: string | null;
};

// --- POMOŽNE FUNKCIJE ---
function eur(n: number) {
  const sign = n >= 0 ? "+" : "";
  return sign + n.toLocaleString("sl-SI", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + "€";
}

function eurFull(n: number) {
  const sign = n >= 0 ? "+" : "";
  return sign + n.toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function hasLay(b: Bet) { return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0; }
function hasBack(b: Bet) { return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0; }

function calcProfit(b: Bet): number {
  if (b.wl === "OPEN" || b.wl === "VOID" || !b.wl) return 0;
  const komZnesek = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0;
  const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0;
  const layOdds = b.lay_kvota || 0;
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;

  let brutoProfit = 0;
  if (hasBack(b) && hasLay(b)) {
    const profitIfBackWins = (backStake * (backOdds - 1)) - layLiability;
    const profitIfLayWins = layStake - backStake;
    if (b.wl === "BACK WIN") brutoProfit = profitIfBackWins;
    else if (b.wl === "LAY WIN") brutoProfit = profitIfLayWins;
    else if (b.wl === "WIN") brutoProfit = Math.max(profitIfBackWins, profitIfLayWins);
    else if (b.wl === "LOSS") brutoProfit = Math.min(profitIfBackWins, profitIfLayWins);
  }
  else if (!hasBack(b) && hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") brutoProfit = layStake;
    else if (b.wl === "LOSS" || b.wl === "BACK WIN") brutoProfit = -layLiability;
  }
  else if (hasBack(b) && !hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") brutoProfit = backStake * (backOdds - 1);
    else if (b.wl === "LOSS" || b.wl === "LAY WIN") brutoProfit = -backStake;
  }
  if (brutoProfit > 0) return brutoProfit - komZnesek;
  return brutoProfit;
}

function calcRisk(b: Bet): number {
  const backStake = b.vplacilo1 || 0;
  const layLiability = b.vplacilo2 || 0;
  if (hasBack(b) && !hasLay(b)) return backStake;
  if (!hasBack(b) && hasLay(b)) return layLiability;
  if (hasBack(b) && hasLay(b)) return Math.max(backStake, layLiability);
  return 0;
}

// Datumske funkcije
function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function getYearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${parseInt(day)}.${parseInt(month)}.`;
}

// Sport emoji
const sportEmojis: Record<string, string> = {
  "NOGOMET": "⚽",
  "TENIS": "🎾",
  "KOŠARKA": "🏀",
  "SM. SKOKI": "🎿",
  "SMUČANJE": "⛷️",
  "BIATLON": "🎯",
  "OSTALO": "🏅"
};

// --- KOMPONENTE ---

// Tooltip za grafe
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const isPositive = value >= 0;
    return (
      <div className="bg-[#09090b]/95 border border-zinc-800 p-3 rounded-xl shadow-2xl backdrop-blur-md">
        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">{label}</p>
        <span className={`text-sm font-mono font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {eurFull(value)}
        </span>
      </div>
    );
  }
  return null;
};

// Modal za prikaz vseh tipsterjev/športov
function StatsModal({ 
  isOpen, 
  onClose, 
  title, 
  period,
  data,
  accentColor,
  icon: Icon
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  period: string;
  data: { name: string; profit: number; bets: number; wins: number; winRate: number }[];
  accentColor: string;
  icon: any;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div 
        className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow */}
        <div className="absolute top-0 left-0 right-0 h-32 opacity-20" style={{ background: `radial-gradient(ellipse at top, ${accentColor}, transparent)` }} />
        
        {/* Header */}
        <div className="relative p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`, border: `1px solid ${accentColor}40` }}
              >
                <Icon className="w-6 h-6" style={{ color: accentColor }} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{title}</h3>
                <p className="text-xs text-zinc-500">{period}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {data.length > 0 ? (
            <div className="space-y-2">
              {data.map((item, index) => (
                <div 
                  key={item.name}
                  className={`flex items-center justify-between p-4 rounded-2xl transition-all ${
                    index === 0 
                      ? 'bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20' 
                      : index === 1 
                        ? 'bg-gradient-to-r from-zinc-500/10 to-transparent border border-zinc-500/20'
                        : index === 2
                          ? 'bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20'
                          : 'bg-zinc-800/30 border border-zinc-800/50 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                      index === 0 ? 'bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30' :
                      index === 1 ? 'bg-zinc-500/20 text-zinc-300 ring-2 ring-zinc-500/30' :
                      index === 2 ? 'bg-orange-500/20 text-orange-400 ring-2 ring-orange-500/30' :
                      'bg-zinc-800 text-zinc-500'
                    }`}>
                      {index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-white">{item.name}</p>
                      <p className="text-[10px] text-zinc-500">
                        {item.bets} stav • {item.wins} zmag • {item.winRate.toFixed(0)}% WR
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-mono font-black ${item.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {eur(item.profit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-zinc-600">Ni podatkov za prikaz</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Kartica za najboljšega (tipster ali šport)
function BestCard({ 
  title, 
  period,
  name, 
  profit, 
  icon: Icon,
  accentColor,
  glowColor,
  decoration,
  onClick
}: {
  title: string;
  period: string;
  name: string | null;
  profit: number;
  icon: any;
  accentColor: string;
  glowColor: string;
  decoration: string;
  onClick: () => void;
}) {
  const hasData = name !== null;
  const profitColor = profit >= 0 ? "text-emerald-400" : "text-rose-400";

  return (
    <div 
      onClick={onClick}
      className={`
        relative rounded-2xl border backdrop-blur-sm overflow-hidden cursor-pointer
        transition-all duration-300 ease-out
        hover:scale-[1.02] hover:-translate-y-1
        bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-black/90
        ${accentColor}
        group
        h-full
      `}
      style={{
        boxShadow: `0 10px 40px -15px ${glowColor}50, 0 0 0 1px ${glowColor}10`
      }}
    >
      {/* Animated glow on hover */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-30 blur-2xl transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at 50% 50%, ${glowColor}, transparent 70%)` }}
      />
      
      {/* Top accent line */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)` }}
      />
      
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative p-5 h-full flex flex-col">
        {/* Header - centered */}
        <div className="flex justify-center mb-2">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
            style={{ background: `linear-gradient(135deg, ${glowColor}30, ${glowColor}10)`, border: `1px solid ${glowColor}40` }}
          >
            <Icon className="w-6 h-6" style={{ color: glowColor }} />
          </div>
        </div>

        {/* Title - centered */}
        <div className="text-center mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: glowColor }}>{title}</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">{period}</p>
        </div>

        {/* Name & Profit - centered */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {hasData ? (
            <>
              <p className="text-xl font-black text-white text-center truncate max-w-full mb-1 group-hover:text-opacity-90">{name}</p>
              <p 
                className={`text-3xl font-mono font-black tracking-tight ${profitColor}`}
                style={{ textShadow: profit >= 0 ? '0 0 30px rgba(16,185,129,0.4)' : '0 0 30px rgba(244,63,94,0.4)' }}
              >
                {eur(profit)}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-600">Ni podatkov</p>
              <p className="text-2xl font-mono text-zinc-700">-</p>
            </>
          )}
        </div>

        {/* Decoration at bottom */}
        <div className="text-center mt-4 text-2xl opacity-60 group-hover:opacity-100 transition-opacity">
          {decoration}
        </div>
      </div>
    </div>
  );
}

// Poročilo kartica
function ReportCard({ 
  title, 
  subtitle,
  icon: Icon, 
  accentColor,
  glowColor,
  profit, 
  stats, 
  chartData,
  expanded,
  onToggle
}: {
  title: string;
  subtitle: string;
  icon: any;
  accentColor: string;
  glowColor: string;
  profit: number;
  stats: { bets: number; wins: number; losses: number; roi: number; winRate: number };
  chartData?: { date: string; profit: number }[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const profitColor = profit >= 0 ? "text-emerald-400" : "text-rose-400";

  return (
    <div 
      className={`
        relative rounded-2xl border backdrop-blur-sm overflow-hidden
        transition-all duration-300 ease-out
        bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-black/90
        ${accentColor}
        min-w-0
        flex flex-col
      `}
      style={{
        boxShadow: expanded 
          ? `0 20px 60px -15px ${glowColor}40, 0 0 0 1px ${glowColor}20` 
          : `0 10px 40px -15px ${glowColor}30, 0 0 0 1px ${glowColor}10`
      }}
    >
      {/* Top accent line */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)` }}
      />
      
      {/* Glow */}
      {expanded && (
        <div 
          className="absolute inset-0 opacity-10 blur-3xl"
          style={{ background: `radial-gradient(circle at 50% 0%, ${glowColor}, transparent 60%)` }}
        />
      )}
      
      {/* Shine */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />

      {/* Header - klikljiv */}
      <div onClick={onToggle} className="relative p-5 cursor-pointer hover:bg-white/5 transition-colors flex flex-col">
        {/* Title & Profit row */}
        <div className="flex items-start justify-between mb-6">
          <div 
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 hover:scale-110 flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${glowColor}30, ${glowColor}10)`, border: `1px solid ${glowColor}40` }}
          >
            <Icon className="w-5 h-5" style={{ color: glowColor }} />
          </div>
          <div className="flex items-center gap-3">
            <span 
              className={`text-2xl font-mono font-black ${profitColor}`}
              style={{ textShadow: profit >= 0 ? '0 0 30px rgba(16,185,129,0.4)' : '0 0 30px rgba(244,63,94,0.4)' }}
            >
              {eurFull(profit)}
            </span>
            <div className={`p-1.5 rounded-lg transition-all duration-300 flex-shrink-0 ${expanded ? 'bg-white/10 rotate-180' : 'bg-transparent'}`}>
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            </div>
          </div>
        </div>

        {/* Centered Title */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-[11px] text-zinc-500 mt-1">{subtitle}</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3 mt-auto">
          {[
            { label: 'Stave', value: stats.bets, color: 'text-white' },
            { label: 'W / L', value: <><span className="text-emerald-400">{stats.wins}</span><span className="text-zinc-600">/</span><span className="text-rose-400">{stats.losses}</span></>, color: '' },
            { label: 'Win%', value: `${stats.winRate.toFixed(0)}%`, color: 'text-white' },
            { label: 'ROI', value: `${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(0)}%`, color: stats.roi >= 0 ? 'text-emerald-400' : 'text-rose-400' }
          ].map((stat, i) => (
            <div key={i} className="text-center p-2.5 rounded-xl bg-black/40 border border-white/5">
              <p className="text-[9px] font-bold text-zinc-500 uppercase mb-0.5">{stat.label}</p>
              <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded - Graf */}
      {expanded && chartData && chartData.length > 0 && (
        <div className="relative px-5 pb-5 border-t border-white/5">
          <div className="h-[200px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={profit >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={profit >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke={profit >= 0 ? "#10b981" : "#f43f5e"} 
                  strokeWidth={2.5} 
                  fill={`url(#gradient-${title})`} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// --- GLAVNA STRAN ---
export default function ReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState<string | null>("week");
  
  // Modal states
  const [modalOpen, setModalOpen] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', user.id)
        .single();

      const isDejan = user.email === "skolnik.dejan40@gmail.com";
      if (!isDejan && (!profile || !profile.is_approved)) {
        router.replace("/pending");
        return;
      }

      await loadRows();
    };

    checkAccess();
  }, [router]);

  async function loadRows() {
    setLoading(true);
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: true });
    setLoading(false);
    if (!error) setRows((data ?? []) as Bet[]);
  }

  // Izračuni
  const data = useMemo(() => {
    const today = getToday();
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();
    const yearStart = getYearStart();

    const weekBets = rows.filter(r => r.datum >= weekStart && r.datum <= today);
    const monthBets = rows.filter(r => r.datum >= monthStart && r.datum <= today);
    const yearBets = rows.filter(r => r.datum >= yearStart && r.datum <= today);

    const calcStats = (bets: Bet[]) => {
      const settled = bets.filter(b => b.wl && b.wl !== "OPEN" && b.wl !== "VOID");
      const wins = settled.filter(b => ["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)).length;
      const losses = settled.filter(b => b.wl === "LOSS").length;
      const profit = settled.reduce((sum, b) => sum + calcProfit(b), 0);
      const risk = settled.reduce((sum, b) => sum + calcRisk(b), 0);
      const roi = risk > 0 ? (profit / risk) * 100 : 0;
      const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;
      return { bets: settled.length, wins, losses, profit, roi, winRate };
    };

    const getAllTipsters = (bets: Bet[]) => {
      const tipsters: Record<string, { profit: number; bets: number; wins: number }> = {};
      bets.filter(b => b.wl && b.wl !== "OPEN" && b.wl !== "VOID").forEach(b => {
        if (!tipsters[b.tipster]) tipsters[b.tipster] = { profit: 0, bets: 0, wins: 0 };
        tipsters[b.tipster].profit += calcProfit(b);
        tipsters[b.tipster].bets++;
        if (["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)) tipsters[b.tipster].wins++;
      });
      return Object.entries(tipsters)
        .map(([name, d]) => ({ name, ...d, winRate: d.bets > 0 ? (d.wins / d.bets) * 100 : 0 }))
        .sort((a, b) => b.profit - a.profit);
    };

    const getAllSports = (bets: Bet[]) => {
      const sports: Record<string, { profit: number; bets: number; wins: number }> = {};
      bets.filter(b => b.wl && b.wl !== "OPEN" && b.wl !== "VOID").forEach(b => {
        if (!sports[b.sport]) sports[b.sport] = { profit: 0, bets: 0, wins: 0 };
        sports[b.sport].profit += calcProfit(b);
        sports[b.sport].bets++;
        if (["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)) sports[b.sport].wins++;
      });
      return Object.entries(sports)
        .map(([name, d]) => ({ name: `${sportEmojis[name] || "🏅"} ${name}`, ...d, winRate: d.bets > 0 ? (d.wins / d.bets) * 100 : 0 }))
        .sort((a, b) => b.profit - a.profit);
    };

    const getChartData = (bets: Bet[]) => {
      const dailyMap = new Map<string, number>();
      bets.filter(b => b.wl && b.wl !== "OPEN" && b.wl !== "VOID").forEach(b => {
        dailyMap.set(b.datum, (dailyMap.get(b.datum) || 0) + calcProfit(b));
      });
      const sortedDates = Array.from(dailyMap.keys()).sort();
      let runningProfit = 0;
      return sortedDates.map(date => {
        runningProfit += dailyMap.get(date) || 0;
        return { date: formatDateShort(date), profit: runningProfit };
      });
    };

    const weekTipsters = getAllTipsters(weekBets);
    const monthTipsters = getAllTipsters(monthBets);
    const yearTipsters = getAllTipsters(yearBets);
    const weekSports = getAllSports(weekBets);
    const monthSports = getAllSports(monthBets);
    const yearSports = getAllSports(yearBets);

    return {
      tipsterWeek: { best: weekTipsters[0] || null, all: weekTipsters },
      tipsterMonth: { best: monthTipsters[0] || null, all: monthTipsters },
      tipsterYear: { best: yearTipsters[0] || null, all: yearTipsters },
      sportWeek: { best: weekSports[0] || null, all: weekSports },
      sportMonth: { best: monthSports[0] || null, all: monthSports },
      sportYear: { best: yearSports[0] || null, all: yearSports },
      week: { stats: calcStats(weekBets), chartData: getChartData(weekBets) },
      month: { stats: calcStats(monthBets), chartData: getChartData(monthBets) },
      year: { stats: calcStats(yearBets), chartData: getChartData(yearBets) }
    };
  }, [rows]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4">
      <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">Nalagam poročila...</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/50 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[600px] bg-gradient-to-b from-emerald-950/20 via-transparent to-transparent pointer-events-none" />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
      `}</style>

      <div className="relative max-w-[1700px] mx-auto px-4 md:px-8 pt-48 pb-12">
        
        {/* Header - LEFT title, RIGHT refresh */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-lg font-black text-white tracking-tight">Poročila</h1>
          </div>
          
          <button 
            onClick={loadRows}
            className="p-3 bg-zinc-900/50 text-zinc-400 border border-zinc-800 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* MAIN GRID - 3 vrstice */}
        <div className="space-y-4">
          
          {/* VRSTICA 1 - Teden */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_280px] gap-4 items-stretch">
            <BestCard
              title="🔥 MVP TEDNA"
              period={`${formatDateShort(getWeekStart())} - danes`}
              name={data.tipsterWeek.best?.name || null}
              profit={data.tipsterWeek.best?.profit || 0}
              icon={Flame}
              accentColor="border-orange-500/30"
              glowColor="#f97316"
              decoration="🏅🔥⭐"
              onClick={() => setModalOpen('tipsterWeek')}
            />
            
            <ReportCard
              title="Tedensko Poročilo"
              subtitle={`${formatDateShort(getWeekStart())} - danes`}
              icon={CalendarRange}
              accentColor="border-cyan-500/30"
              glowColor="#06b6d4"
              profit={data.week.stats.profit}
              stats={data.week.stats}
              chartData={data.week.chartData}
              expanded={expandedReport === "week"}
              onToggle={() => setExpandedReport(expandedReport === "week" ? null : "week")}
            />
            
            <BestCard
              title="🔥 MVP TEDNA"
              period={`${formatDateShort(getWeekStart())} - danes`}
              name={data.sportWeek.best?.name || null}
              profit={data.sportWeek.best?.profit || 0}
              icon={Zap}
              accentColor="border-lime-500/30"
              glowColor="#84cc16"
              decoration="⚽🎾🏀"
              onClick={() => setModalOpen('sportWeek')}
            />
          </div>

          {/* VRSTICA 2 - Mesec */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_280px] gap-4 items-stretch">
            <BestCard
              title="👑 KING MESECA"
              period={new Date().toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' })}
              name={data.tipsterMonth.best?.name || null}
              profit={data.tipsterMonth.best?.profit || 0}
              icon={Crown}
              accentColor="border-fuchsia-500/30"
              glowColor="#d946ef"
              decoration="👑💎✨"
              onClick={() => setModalOpen('tipsterMonth')}
            />
            
            <ReportCard
              title="Mesečno Poročilo"
              subtitle={new Date().toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' })}
              icon={CalendarDays}
              accentColor="border-violet-500/30"
              glowColor="#8b5cf6"
              profit={data.month.stats.profit}
              stats={data.month.stats}
              chartData={data.month.chartData}
              expanded={expandedReport === "month"}
              onToggle={() => setExpandedReport(expandedReport === "month" ? null : "month")}
            />
            
            <BestCard
              title="👑 KING MESECA"
              period={new Date().toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' })}
              name={data.sportMonth.best?.name || null}
              profit={data.sportMonth.best?.profit || 0}
              icon={Star}
              accentColor="border-pink-500/30"
              glowColor="#ec4899"
              decoration="🏆🎯💫"
              onClick={() => setModalOpen('sportMonth')}
            />
          </div>

          {/* VRSTICA 3 - Leto */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_280px] gap-4 items-stretch">
            <BestCard
              title="🏆 HALL OF FAME"
              period={`${new Date().getFullYear()}`}
              name={data.tipsterYear.best?.name || null}
              profit={data.tipsterYear.best?.profit || 0}
              icon={Award}
              accentColor="border-amber-500/30"
              glowColor="#f59e0b"
              decoration="🥇🏆🎖️"
              onClick={() => setModalOpen('tipsterYear')}
            />
            
            <ReportCard
              title="Letno Poročilo"
              subtitle={`${new Date().getFullYear()}`}
              icon={Trophy}
              accentColor="border-emerald-500/30"
              glowColor="#10b981"
              profit={data.year.stats.profit}
              stats={data.year.stats}
              chartData={data.year.chartData}
              expanded={expandedReport === "year"}
              onToggle={() => setExpandedReport(expandedReport === "year" ? null : "year")}
            />
            
            <BestCard
              title="🏆 HALL OF FAME"
              period={`${new Date().getFullYear()}`}
              name={data.sportYear.best?.name || null}
              profit={data.sportYear.best?.profit || 0}
              icon={TrendingUp}
              accentColor="border-sky-500/30"
              glowColor="#0ea5e9"
              decoration="🌟🎊🏅"
              onClick={() => setModalOpen('sportYear')}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-zinc-900 text-center flex flex-col md:flex-row justify-between items-center text-zinc-600 text-xs gap-2">
          <p>© 2026 DDTips Analytics. Vse pravice pridržane.</p>
          <p className="font-mono text-zinc-700">Poročila v živo</p>
        </footer>
      </div>

      {/* MODALI */}
      <StatsModal
        isOpen={modalOpen === 'tipsterWeek'}
        onClose={() => setModalOpen(null)}
        title="🔥 MVP Tedna - Vsi Tipsterji"
        period={`${formatDateShort(getWeekStart())} - danes`}
        data={data.tipsterWeek.all}
        accentColor="#f97316"
        icon={Flame}
      />
      <StatsModal
        isOpen={modalOpen === 'tipsterMonth'}
        onClose={() => setModalOpen(null)}
        title="👑 King Meseca - Vsi Tipsterji"
        period={new Date().toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' })}
        data={data.tipsterMonth.all}
        accentColor="#d946ef"
        icon={Crown}
      />
      <StatsModal
        isOpen={modalOpen === 'tipsterYear'}
        onClose={() => setModalOpen(null)}
        title="🏆 Hall of Fame - Vsi Tipsterji"
        period={`${new Date().getFullYear()}`}
        data={data.tipsterYear.all}
        accentColor="#f59e0b"
        icon={Award}
      />
      <StatsModal
        isOpen={modalOpen === 'sportWeek'}
        onClose={() => setModalOpen(null)}
        title="🔥 MVP Tedna - Vsi Športi"
        period={`${formatDateShort(getWeekStart())} - danes`}
        data={data.sportWeek.all}
        accentColor="#84cc16"
        icon={Zap}
      />
      <StatsModal
        isOpen={modalOpen === 'sportMonth'}
        onClose={() => setModalOpen(null)}
        title="👑 King Meseca - Vsi Športi"
        period={new Date().toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' })}
        data={data.sportMonth.all}
        accentColor="#ec4899"
        icon={Star}
      />
      <StatsModal
        isOpen={modalOpen === 'sportYear'}
        onClose={() => setModalOpen(null)}
        title="🏆 Hall of Fame - Vsi Športi"
        period={`${new Date().getFullYear()}`}
        data={data.sportYear.all}
        accentColor="#0ea5e9"
        icon={TrendingUp}
      />
    </main>
  );
}