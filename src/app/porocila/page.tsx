"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, Trophy, Activity, RefreshCw,
  Target, Flame, Crown, ChevronLeft, ChevronRight,
  Sparkles, DollarSign, Percent, Hash,
  MessageCircle, Clock, ChevronDown, ChevronUp,
  Sun, Timer, CalendarDays, CalendarRange
} from "lucide-react";

// --- TYPES ---
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
  tekma?: string;
  tip?: string;
  dogodek?: string;
};

type PeriodType = "day" | "week" | "month" | "year";

// --- HELPERS ---
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

// --- DATE FUNCTIONS ---
function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day)}.${parseInt(month)}.${year}`;
}

function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${parseInt(day)}.${parseInt(month)}.`;
}

function getWeekNumber(d: Date): number {
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getWeekRange(year: number, week: number): { start: string; end: string } {
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7;
  const firstDayOfWeek = new Date(firstDayOfYear);
  firstDayOfWeek.setDate(firstDayOfYear.getDate() + daysOffset - firstDayOfYear.getDay() + 1);
  const lastDayOfWeek = new Date(firstDayOfWeek);
  lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
  return { start: formatDate(firstDayOfWeek), end: formatDate(lastDayOfWeek) };
}

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: formatDate(start), end: formatDate(end) };
}

function getYearRange(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function getDayRange(date: Date): { start: string; end: string } {
  const d = formatDate(date);
  return { start: d, end: d };
}

const sportEmojis: Record<string, string> = {
  "NOGOMET": "⚽",
  "TENIS": "🎾",
  "KOŠARKA": "🏀",
  "SM. SKOKI": "🎿",
  "SMUČANJE": "⛷️",
  "BIATLON": "🎯",
  "HOKEJ": "🏒",
  "ROKOMET": "🤾",
  "ODBOJKA": "🏐",
  "OSTALO": "🏅"
};

const monthNames = [
  "Januar", "Februar", "Marec", "April", "Maj", "Junij",
  "Julij", "Avgust", "September", "Oktober", "November", "December"
];

const dayNames = ["Nedelja", "Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota"];

// --- 3D TILT WRAPPER COMPONENT ---
function Tilt3DWrapper({ 
  children, 
  className = "",
  glowColor = "#5c67ff"
}: { 
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}) {
  const [transform, setTransform] = useState("rotateX(0deg) rotateY(0deg)");
  const [glowOpacity, setGlowOpacity] = useState(0);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;
    
    setTransform(`rotateX(${rotateX}deg) rotateY(${rotateY}deg)`);
    setGlowOpacity(1);
  };
  
  const handleMouseLeave = () => {
    setTransform("rotateX(0deg) rotateY(0deg)");
    setGlowOpacity(0);
  };
  
  return (
    <div 
      className={`tilt3d-wrapper ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: "800px" }}
    >
      <div 
        className="tilt3d-inner"
        style={{ 
          transform,
          transition: "transform 150ms ease-out"
        }}
      >
        {children}
        {/* Glow overlay */}
        <div 
          className="tilt3d-glow"
          style={{ 
            opacity: glowOpacity,
            background: `radial-gradient(circle at 50% 50%, ${glowColor}20, transparent 70%)`
          }}
        />
        {/* Corner elements */}
        <div className="tilt3d-corners" style={{ opacity: glowOpacity }}>
          <span style={{ borderColor: glowColor }} />
          <span style={{ borderColor: glowColor }} />
          <span style={{ borderColor: glowColor }} />
          <span style={{ borderColor: glowColor }} />
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTS ---

// Modal za prikaz podrobnosti stave
function BetDetailModal({ 
  bet, 
  isOpen, 
  onClose,
  title
}: { 
  bet: Bet | null; 
  isOpen: boolean; 
  onClose: () => void;
  title: string;
}) {
  if (!isOpen || !bet) return null;
  
  const profit = calcProfit(bet);
  const isWin = bet.wl === "WIN" || bet.wl === "BACK WIN" || bet.wl === "LAY WIN";
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div 
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-5 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl">
                {sportEmojis[bet.sport] || "🏅"}
              </div>
              <div>
                <h3 className="font-bold text-white">{title}</h3>
                <p className="text-xs text-zinc-500">{bet.sport}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-zinc-700/50 transition-colors text-zinc-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Tekma */}
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Tekma</p>
            <p className="text-lg font-bold text-white">{bet.tekma || bet.sport}</p>
          </div>
          
          {/* Dogodek */}
          {bet.dogodek && (
            <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400/70 mb-1">Dogodek</p>
              <p className="text-base font-semibold text-violet-300">{bet.dogodek}</p>
            </div>
          )}
          
          {/* Tip */}
          {bet.tip && (
            <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Tip</p>
              <p className="text-base font-semibold text-zinc-200">{bet.tip}</p>
            </div>
          )}
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/70 mb-1">Kvota</p>
              <p className="text-2xl font-black text-amber-400">@{bet.kvota1?.toFixed(2)}</p>
            </div>
            <div className={`p-4 rounded-xl ${isWin ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isWin ? 'text-emerald-400/70' : 'text-rose-400/70'} mb-1`}>Profit</p>
              <p className={`text-2xl font-black ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>{eur(profit)}</p>
            </div>
          </div>
          
          {/* Meta info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-zinc-800/30 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Tipster</p>
              <p className="text-sm font-semibold text-white">{bet.tipster}</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-800/30 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Datum</p>
              <p className="text-sm font-semibold text-white">{formatDateDisplay(bet.datum)}</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-800/30 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Status</p>
              <p className={`text-sm font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>{bet.wl}</p>
            </div>
          </div>
          
          {/* Additional info */}
          {(bet.stavnica || bet.vplacilo1) && (
            <div className="grid grid-cols-2 gap-3">
              {bet.stavnica && (
                <div className="p-3 rounded-xl bg-zinc-800/30 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Stavnica</p>
                  <p className="text-sm font-semibold text-white">{bet.stavnica}</p>
                </div>
              )}
              {bet.vplacilo1 > 0 && (
                <div className="p-3 rounded-xl bg-zinc-800/30 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Vložek</p>
                  <p className="text-sm font-semibold text-white">{bet.vplacilo1.toFixed(2)}€</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors"
          >
            Zapri
          </button>
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const isPositive = value >= 0;
    return (
      <div className="bg-[#0a0a0f]/95 border border-zinc-800/50 p-3 rounded-xl shadow-2xl backdrop-blur-xl">
        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">{label}</p>
        <span className={`text-sm font-mono font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {eurFull(value)}
        </span>
      </div>
    );
  }
  return null;
};

function PeriodNavigator({ 
  currentOffset, 
  onOffsetChange,
  periodLabel 
}: { 
  currentOffset: number;
  onOffsetChange: (offset: number) => void;
  periodLabel: string;
}) {
  const canGoForward = currentOffset < 0;
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onOffsetChange(currentOffset - 1)}
        className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/50 hover:bg-zinc-800/80 hover:border-zinc-700/50 transition-all duration-200"
      >
        <ChevronLeft className="w-4 h-4 text-zinc-500 hover:text-zinc-300" />
      </button>
      
      <div className="min-w-[160px] text-center px-3 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800/30">
        <span className="text-sm font-semibold text-zinc-300">{periodLabel}</span>
      </div>
      
      <button
        onClick={() => onOffsetChange(currentOffset + 1)}
        disabled={!canGoForward}
        className={`p-2 rounded-xl transition-all duration-200 ${
          canGoForward 
            ? 'bg-zinc-900/80 border border-zinc-800/50 hover:bg-zinc-800/80' 
            : 'bg-zinc-900/30 border border-zinc-800/20 cursor-not-allowed opacity-50'
        }`}
      >
        <ChevronRight className={`w-4 h-4 ${canGoForward ? 'text-zinc-500' : 'text-zinc-700'}`} />
      </button>
    </div>
  );
}

function PeriodTab({ 
  active, 
  icon: Icon, 
  label, 
  onClick 
}: { 
  active: boolean; 
  icon: any; 
  label: string; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300
        ${active 
          ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30' 
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color = "emerald"
}: { 
  icon: any; 
  label: string; 
  value: string | number | React.ReactNode; 
  color?: "emerald" | "rose" | "amber" | "cyan" | "white";
}) {
  const colorClasses: Record<string, string> = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400",
    rose: "from-rose-500/20 to-rose-500/5 border-rose-500/30 text-rose-400",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400",
    cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400",
    white: "from-zinc-500/20 to-zinc-500/5 border-zinc-500/30 text-zinc-300"
  };
  
  const glowColors: Record<string, string> = {
    emerald: "#10b981",
    rose: "#f43f5e",
    amber: "#f59e0b",
    cyan: "#06b6d4",
    white: "#a1a1aa"
  };
  
  const classes = colorClasses[color] || colorClasses.emerald;
  const glowColor = glowColors[color] || glowColors.emerald;
  const [gradientFrom, gradientTo, borderColor, textColor] = classes.split(' ');
  
  return (
    <Tilt3DWrapper glowColor={glowColor}>
      <div className={`relative p-4 rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} border ${borderColor} backdrop-blur-sm`}>
        <div className="flex items-start justify-between mb-2">
          <div className="w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center">
            <Icon className={`w-4 h-4 ${textColor}`} />
          </div>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
        <p className={`text-xl font-black ${textColor}`}>{value}</p>
      </div>
    </Tilt3DWrapper>
  );
}

function LeaderboardCard({ 
  title, 
  icon: Icon, 
  accentColor,
  data,
  type,
  onItemClick
}: { 
  title: string; 
  icon: any; 
  accentColor: string;
  data: { id?: string; name: string; value: number; secondary?: string; bet?: Bet }[];
  type: "profit" | "odds";
  onItemClick?: (bet: Bet, title: string) => void;
}) {
  return (
    <Tilt3DWrapper glowColor={accentColor}>
      <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`, border: `1px solid ${accentColor}40` }}
            >
              <Icon className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <h3 className="font-bold text-white text-sm">{title}</h3>
          </div>
        </div>
        
        <div className="p-3 space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar">
          {data.length > 0 ? data.slice(0, 5).map((item, index) => (
            <div 
              key={item.id || `${index}-${item.value}`}
              onClick={() => item.bet && onItemClick && onItemClick(item.bet, item.name)}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                item.bet && onItemClick ? 'cursor-pointer' : ''
              } ${
                index === 0 
                  ? 'bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 hover:from-amber-500/20' 
                  : 'bg-zinc-800/30 border border-zinc-800/30 hover:bg-zinc-800/50'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                index === 0 ? 'bg-amber-500/20 text-amber-400' :
                index === 1 ? 'bg-zinc-600/30 text-zinc-400' :
                index === 2 ? 'bg-orange-600/20 text-orange-400' :
                'bg-zinc-800 text-zinc-600'
              }`}>
                {index === 0 ? '👑' : index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{item.name}</p>
                {item.secondary && <p className="text-[10px] text-zinc-500 truncate">{item.secondary}</p>}
              </div>
              <div className="text-right">
                <p className={`font-mono font-bold text-sm ${
                  type === "profit" 
                    ? item.value >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    : 'text-amber-400'
                }`}>
                  {type === "profit" ? eur(item.value) : item.value.toFixed(2)}
                </p>
              </div>
            </div>
          )) : (
            <div className="text-center py-8">
              <p className="text-zinc-600 text-sm">Ni podatkov</p>
            </div>
          )}
        </div>
      </div>
    </Tilt3DWrapper>
  );
}

function HighlightCard({ 
  title, 
  icon: Icon, 
  value, 
  matchName,
  tipName,
  tipster,
  date,
  accentColor,
  onClick
}: { 
  title: string; 
  icon: any; 
  value: string | number;
  matchName?: string;
  tipName?: string;
  tipster?: string;
  date?: string;
  accentColor: string;
  onClick?: () => void;
}) {
  const hasData = matchName || tipName;
  
  return (
    <Tilt3DWrapper glowColor={accentColor}>
      <div 
        className={`relative p-4 rounded-xl bg-zinc-900/70 border backdrop-blur-sm overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
        style={{ borderColor: `${accentColor}25` }}
        onClick={onClick}
      >
        <div 
          className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
        />
        
        <div className="relative flex items-center gap-4">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}
          >
            <Icon className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">{title}</p>
            {hasData ? (
              <>
                <p className="text-sm font-semibold text-white truncate">{matchName}</p>
                {tipName && <p className="text-xs text-zinc-400 truncate">{tipName}</p>}
                <p className="text-[10px] text-zinc-600 mt-0.5">{tipster}{date ? ` • ${date}` : ''}</p>
              </>
            ) : (
              <p className="text-sm text-zinc-600">Ni podatkov</p>
            )}
          </div>
          
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-black font-mono" style={{ color: accentColor }}>
              {value}
            </p>
          </div>
        </div>
      </div>
    </Tilt3DWrapper>
  );
}

function LiveFeedItem({ bet }: { bet: Bet }) {
  const profit = calcProfit(bet);
  const isWin = bet.wl === "WIN" || bet.wl === "BACK WIN" || bet.wl === "LAY WIN";
  const isLoss = bet.wl === "LOSS";
  const isOpen = bet.wl === "OPEN";
  
  return (
    <div className={`relative p-3 rounded-xl border transition-all duration-300 ${
      isOpen 
        ? 'bg-amber-500/5 border-amber-500/20' 
        : isWin 
          ? 'bg-emerald-500/5 border-emerald-500/20' 
          : isLoss 
            ? 'bg-rose-500/5 border-rose-500/20'
            : 'bg-zinc-800/30 border-zinc-800/30'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
          isOpen ? 'bg-amber-500/20' : isWin ? 'bg-emerald-500/20' : isLoss ? 'bg-rose-500/20' : 'bg-zinc-700/50'
        }`}>
          {sportEmojis[bet.sport] || "🏅"}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
              isOpen 
                ? 'bg-amber-500/20 text-amber-400' 
                : isWin 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : isLoss 
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-zinc-700/50 text-zinc-400'
            }`}>
              {bet.wl || "N/A"}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">{bet.tipster}</span>
          </div>
          
          <p className="text-xs font-medium text-white truncate">{bet.tekma || bet.sport}</p>
          {bet.tip && <p className="text-[11px] text-zinc-400 truncate mt-0.5">{bet.tip}</p>}
          
          <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-1">
            <span className="font-mono">@{bet.kvota1?.toFixed(2) || "-"}</span>
            <span>•</span>
            <span>{formatDateShort(bet.datum)}</span>
          </div>
        </div>
        
        <div className="text-right flex-shrink-0">
          {!isOpen ? (
            <p className={`font-mono font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {eur(profit)}
            </p>
          ) : (
            <div className="flex items-center gap-1 text-amber-400">
              <Timer className="w-3 h-3 animate-pulse" />
              <span className="text-[10px] font-bold">LIVE</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- MAIN PAGE ---
export default function ReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState<PeriodType>("day");
  const [offsets, setOffsets] = useState<Record<PeriodType, number>>({
    day: 0, week: 0, month: 0, year: 0
  });
  const [showChart, setShowChart] = useState(true);
  const [selectedBet, setSelectedBet] = useState<{ bet: Bet | null; title: string } | null>(null);

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

  const updateOffset = useCallback((period: PeriodType, newOffset: number) => {
    setOffsets(prev => ({ ...prev, [period]: newOffset }));
  }, []);

  const periodData = useMemo(() => {
    const today = new Date();
    let range: { start: string; end: string };
    let label: string;
    let dateRange: string;
    
    switch (activePeriod) {
      case "day": {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + offsets.day);
        range = getDayRange(targetDate);
        const isToday = offsets.day === 0;
        const isYesterday = offsets.day === -1;
        label = isToday ? "Danes" : isYesterday ? "Včeraj" : `${dayNames[targetDate.getDay()]}`;
        dateRange = formatDateDisplay(range.start);
        break;
      }
      case "week": {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + (offsets.week * 7));
        const weekNum = getWeekNumber(targetDate);
        range = getWeekRange(targetDate.getFullYear(), weekNum);
        label = `Teden ${weekNum}`;
        dateRange = `${formatDateShort(range.start)} - ${formatDateDisplay(range.end)}`;
        break;
      }
      case "month": {
        const targetDate = new Date(today.getFullYear(), today.getMonth() + offsets.month, 1);
        range = getMonthRange(targetDate.getFullYear(), targetDate.getMonth());
        label = `${monthNames[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
        dateRange = `${formatDateShort(range.start)} - ${formatDateDisplay(range.end)}`;
        break;
      }
      case "year": {
        const targetYear = today.getFullYear() + offsets.year;
        range = getYearRange(targetYear);
        label = `Leto ${targetYear}`;
        dateRange = `1.1.${targetYear} - 31.12.${targetYear}`;
        break;
      }
    }
    
    return { range, label, dateRange };
  }, [activePeriod, offsets]);

  const data = useMemo(() => {
    const { start, end } = periodData.range;
    const periodBets = rows.filter(r => r.datum >= start && r.datum <= end);
    const settledBets = periodBets.filter(b => b.wl && b.wl !== "OPEN" && b.wl !== "VOID");
    const openBets = periodBets.filter(b => b.wl === "OPEN");
    
    const wins = settledBets.filter(b => ["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)).length;
    const losses = settledBets.filter(b => b.wl === "LOSS").length;
    const totalProfit = settledBets.reduce((sum, b) => sum + calcProfit(b), 0);
    const totalRisk = settledBets.reduce((sum, b) => sum + calcRisk(b), 0);
    const roi = totalRisk > 0 ? (totalProfit / totalRisk) * 100 : 0;
    const winRate = settledBets.length > 0 ? (wins / settledBets.length) * 100 : 0;
    const avgOdds = settledBets.length > 0 
      ? settledBets.reduce((sum, b) => sum + (b.kvota1 || 0), 0) / settledBets.length 
      : 0;
    
    // Tipsters
    const tipsterMap: Record<string, { profit: number; bets: number; wins: number }> = {};
    settledBets.forEach(b => {
      if (!tipsterMap[b.tipster]) tipsterMap[b.tipster] = { profit: 0, bets: 0, wins: 0 };
      tipsterMap[b.tipster].profit += calcProfit(b);
      tipsterMap[b.tipster].bets++;
      if (["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)) tipsterMap[b.tipster].wins++;
    });
    const tipsters = Object.entries(tipsterMap)
      .map(([name, d], idx) => ({ 
        id: `tipster-${idx}-${name}`,
        name, 
        value: d.profit, 
        secondary: `${d.bets} stav • ${(d.bets > 0 ? (d.wins / d.bets) * 100 : 0).toFixed(0)}% WR` 
      }))
      .sort((a, b) => b.value - a.value);
    
    // Sports
    const sportMap: Record<string, { profit: number; bets: number; wins: number }> = {};
    settledBets.forEach(b => {
      if (!sportMap[b.sport]) sportMap[b.sport] = { profit: 0, bets: 0, wins: 0 };
      sportMap[b.sport].profit += calcProfit(b);
      sportMap[b.sport].bets++;
      if (["WIN", "BACK WIN", "LAY WIN"].includes(b.wl)) sportMap[b.sport].wins++;
    });
    const sports = Object.entries(sportMap)
      .map(([name, d], idx) => ({ 
        id: `sport-${idx}-${name}`,
        name: `${sportEmojis[name] || "🏅"} ${name}`, 
        value: d.profit,
        secondary: `${d.bets} stav`
      }))
      .sort((a, b) => b.value - a.value);
    
    // Winning bets
    const winningBets = settledBets.filter(b => ["WIN", "BACK WIN", "LAY WIN"].includes(b.wl));
    const highestOddsBet = winningBets.length > 0 
      ? winningBets.reduce((max, b) => (b.kvota1 || 0) > (max.kvota1 || 0) ? b : max, winningBets[0])
      : null;
    const biggestWinBet = winningBets.length > 0
      ? winningBets.reduce((max, b) => calcProfit(b) > calcProfit(max) ? b : max, winningBets[0])
      : null;
    
    // Top odds
    const topOdds = winningBets
      .map((b, idx) => ({ 
        id: `odds-${idx}-${b.id}`,
        name: b.tekma || b.sport,
        value: b.kvota1 || 0,
        secondary: b.tip ? `${b.tip} • ${b.tipster}` : b.tipster,
        bet: b
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    
    // Top wins
    const topWins = winningBets
      .map((b, idx) => ({
        id: `win-${idx}-${b.id}`,
        name: b.tekma || b.sport,
        value: calcProfit(b),
        secondary: b.tip ? `${b.tip} • @${(b.kvota1 || 0).toFixed(2)}` : `${b.tipster} • @${(b.kvota1 || 0).toFixed(2)}`,
        bet: b
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    
    // Chart data
    const dailyMap = new Map<string, number>();
    settledBets.forEach(b => {
      dailyMap.set(b.datum, (dailyMap.get(b.datum) || 0) + calcProfit(b));
    });
    const sortedDates = Array.from(dailyMap.keys()).sort();
    let runningProfit = 0;
    const chartData = sortedDates.map(date => {
      runningProfit += dailyMap.get(date) || 0;
      return { date: formatDateShort(date), profit: runningProfit };
    });
    
    // Recent bets
    const recentBets = [...periodBets]
      .sort((a, b) => {
        const dateCompare = b.datum.localeCompare(a.datum);
        if (dateCompare !== 0) return dateCompare;
        return (b.cas_stave || "").localeCompare(a.cas_stave || "");
      })
      .slice(0, 20);
    
    return {
      stats: { totalBets: periodBets.length, settledBets: settledBets.length, openBets: openBets.length, wins, losses, totalProfit, roi, winRate, avgOdds },
      tipsters,
      sports,
      topOdds,
      topWins,
      highestOddsBet,
      biggestWinBet,
      chartData,
      recentBets
    };
  }, [rows, periodData]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050508] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">Nalagam poročila...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050508] text-white antialiased selection:bg-emerald-500/30">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-950/30 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-cyan-950/20 via-transparent to-transparent" />
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
        
        /* 3D Tilt Wrapper Styles */
        .tilt3d-wrapper {
          position: relative;
        }
        
        .tilt3d-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
        }
        
        .tilt3d-inner > *:first-child {
          position: relative;
          z-index: 1;
        }
        
        .tilt3d-glow {
          position: absolute;
          inset: -10px;
          border-radius: inherit;
          pointer-events: none;
          transition: opacity 0.3s ease;
          z-index: 0;
        }
        
        .tilt3d-corners {
          position: absolute;
          inset: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
          z-index: 10;
        }
        
        .tilt3d-corners span {
          position: absolute;
          width: 12px;
          height: 12px;
          border: 2px solid;
          opacity: 0.6;
          transition: all 0.3s ease;
        }
        
        .tilt3d-corners span:nth-child(1) { top: 4px; left: 4px; border-right: 0; border-bottom: 0; border-radius: 4px 0 0 0; }
        .tilt3d-corners span:nth-child(2) { top: 4px; right: 4px; border-left: 0; border-bottom: 0; border-radius: 0 4px 0 0; }
        .tilt3d-corners span:nth-child(3) { bottom: 4px; left: 4px; border-right: 0; border-top: 0; border-radius: 0 0 0 4px; }
        .tilt3d-corners span:nth-child(4) { bottom: 4px; right: 4px; border-left: 0; border-top: 0; border-radius: 0 0 4px 0; }
        
        .tilt3d-wrapper:hover .tilt3d-corners span {
          opacity: 1;
          box-shadow: 0 0 8px currentColor;
        }
        
        .tilt3d-wrapper:hover .tilt3d-inner > *:first-child {
          filter: brightness(1.05);
        }
      `}</style>

      <div className="relative flex min-h-screen">
        <div className="flex-1 px-4 md:px-6 lg:px-8 pt-44 pb-8 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto">

            {/* Period Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-2 bg-zinc-900/30 rounded-2xl border border-zinc-800/30">
              <div className="flex items-center gap-2">
                <PeriodTab active={activePeriod === "day"} icon={Sun} label="Dan" onClick={() => setActivePeriod("day")} />
                <PeriodTab active={activePeriod === "week"} icon={CalendarRange} label="Teden" onClick={() => setActivePeriod("week")} />
                <PeriodTab active={activePeriod === "month"} icon={CalendarDays} label="Mesec" onClick={() => setActivePeriod("month")} />
                <PeriodTab active={activePeriod === "year"} icon={Trophy} label="Leto" onClick={() => setActivePeriod("year")} />
              </div>
              
              <div className="flex items-center gap-3">
                <PeriodNavigator
                  currentOffset={offsets[activePeriod]}
                  onOffsetChange={(newOffset) => updateOffset(activePeriod, newOffset)}
                  periodLabel={periodData.label}
                />
                
                <button 
                  onClick={loadRows}
                  className="p-2.5 bg-zinc-900/80 text-zinc-400 border border-zinc-800/50 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                  title="Osveži podatke"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Profit Hero */}
            <Tilt3DWrapper glowColor={data.stats.totalProfit >= 0 ? "#10b981" : "#f43f5e"} className="mb-6">
              <div className="relative p-6 rounded-3xl bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-black/90 border border-zinc-800/50 overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{
                  background: data.stats.totalProfit >= 0 
                    ? 'radial-gradient(ellipse at top left, #10b981, transparent 50%)' 
                    : 'radial-gradient(ellipse at top left, #f43f5e, transparent 50%)'
                }} />
                
                <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div>
                    <div className="mb-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        Skupni profit • {periodData.label}
                      </p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        {periodData.dateRange}
                      </p>
                    </div>
                    <p className={`text-5xl md:text-6xl font-black tracking-tight ${data.stats.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {eurFull(data.stats.totalProfit)}
                    </p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-sm text-zinc-400">
                        <span className="font-bold text-white">{data.stats.settledBets}</span> zaključenih stav
                      </span>
                      {data.stats.openBets > 0 && (
                        <span className="flex items-center gap-1 text-sm text-amber-400">
                          <Timer className="w-3 h-3" />
                          <span className="font-bold">{data.stats.openBets}</span> odprtih
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard icon={Target} label="Win Rate" value={`${data.stats.winRate.toFixed(0)}%`} color="cyan" />
                    <StatCard icon={Percent} label="ROI" value={`${data.stats.roi >= 0 ? '+' : ''}${data.stats.roi.toFixed(1)}%`} color={data.stats.roi >= 0 ? "emerald" : "rose"} />
                    <StatCard icon={TrendingUp} label="W / L" value={<><span className="text-emerald-400">{data.stats.wins}</span><span className="text-zinc-600">/</span><span className="text-rose-400">{data.stats.losses}</span></>} color="white" />
                    <StatCard icon={Hash} label="Povp. Kvota" value={data.stats.avgOdds.toFixed(2)} color="amber" />
                  </div>
                </div>
              </div>
            </Tilt3DWrapper>

            {/* Chart */}
            {data.chartData.length > 1 && (
              <Tilt3DWrapper glowColor="#10b981" className="mb-6">
                <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      Kumulativni profit
                    </h3>
                    <button onClick={() => setShowChart(!showChart)} className="p-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
                      {showChart ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </button>
                  </div>
                  
                  {showChart && (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.chartData}>
                          <defs>
                            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={data.stats.totalProfit >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0.4}/>
                              <stop offset="95%" stopColor={data.stats.totalProfit >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="profit" stroke={data.stats.totalProfit >= 0 ? "#10b981" : "#f43f5e"} strokeWidth={2.5} fill="url(#profitGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </Tilt3DWrapper>
            )}

            {/* Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <HighlightCard
                title="Največja zadeta kvota"
                icon={Sparkles}
                value={data.highestOddsBet ? `@${data.highestOddsBet.kvota1?.toFixed(2)}` : "-"}
                matchName={data.highestOddsBet?.tekma || data.highestOddsBet?.sport}
                tipName={data.highestOddsBet?.tip}
                tipster={data.highestOddsBet?.tipster}
                date={data.highestOddsBet ? formatDateShort(data.highestOddsBet.datum) : undefined}
                accentColor="#f59e0b"
                onClick={data.highestOddsBet ? () => setSelectedBet({ bet: data.highestOddsBet, title: "Največja zadeta kvota" }) : undefined}
              />
              <HighlightCard
                title="Največji zaslužek"
                icon={DollarSign}
                value={data.biggestWinBet ? eur(calcProfit(data.biggestWinBet)) : "-"}
                matchName={data.biggestWinBet?.tekma || data.biggestWinBet?.sport}
                tipName={data.biggestWinBet?.tip}
                tipster={data.biggestWinBet?.tipster}
                date={data.biggestWinBet ? formatDateShort(data.biggestWinBet.datum) : undefined}
                accentColor="#10b981"
                onClick={data.biggestWinBet ? () => setSelectedBet({ bet: data.biggestWinBet, title: "Največji zaslužek" }) : undefined}
              />
            </div>

            {/* Leaderboards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <LeaderboardCard title="Top Tipsterji" icon={Crown} accentColor="#d946ef" data={data.tipsters} type="profit" />
              <LeaderboardCard title="Top Športi" icon={Flame} accentColor="#f97316" data={data.sports} type="profit" />
              <LeaderboardCard 
                title="Najvišje Kvote" 
                icon={Sparkles} 
                accentColor="#f59e0b" 
                data={data.topOdds} 
                type="odds" 
                onItemClick={(bet, name) => setSelectedBet({ bet, title: name })}
              />
              <LeaderboardCard 
                title="Največji Dobički" 
                icon={DollarSign} 
                accentColor="#10b981" 
                data={data.topWins} 
                type="profit" 
                onItemClick={(bet, name) => setSelectedBet({ bet, title: name })}
              />
            </div>

            {/* Footer */}
            <footer className="mt-12 pt-6 border-t border-zinc-900/50 text-center">
              <p className="text-zinc-600 text-xs">© 2026 DDTips Analytics</p>
            </footer>
          </div>
        </div>

        {/* Live Feed Sidebar */}
        <div className="hidden xl:flex flex-col w-[340px] border-l border-zinc-800/50 bg-zinc-900/30 pt-44 h-screen sticky top-0">
          <div className="p-4 border-b border-zinc-800/50 bg-[#050508]/80 backdrop-blur-xl flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-violet-400" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">Live Feed</h2>
                <p className="text-[10px] text-zinc-500">Zadnje stave</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar min-h-0">
            {data.recentBets.length > 0 ? (
              data.recentBets.map((bet) => (
                <LiveFeedItem key={bet.id} bet={bet} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-zinc-500 text-sm font-medium">Ni stav v tem obdobju</p>
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-zinc-800/50 bg-zinc-900/50 flex-shrink-0">
            <div className="flex items-center justify-between text-[10px] text-zinc-600">
              <span>Prikazanih: {data.recentBets.length}</span>
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                V živo
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal za prikaz podrobnosti */}
      <BetDetailModal
        bet={selectedBet?.bet || null}
        isOpen={selectedBet !== null}
        onClose={() => setSelectedBet(null)}
        title={selectedBet?.title || ""}
      />
    </main>
  );
}