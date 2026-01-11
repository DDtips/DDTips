"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, BarChart3, TrendingUp, Home, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// --- POMOŽNA FUNKCIJA ZA PROFIT ---
function calcProfit(b: any): number {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;
  const komZnesek = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0;
  const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0; 
  const layOdds = b.lay_kvota || 0;
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;

  let brutoProfit = 0;
  const hasBack = (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0;
  const hasLay = (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0;

  if (hasBack && hasLay) {
    const profitIfBackWins = (backStake * (backOdds - 1)) - layLiability;
    const profitIfLayWins = layStake - backStake;
    if (b.wl === "BACK WIN") brutoProfit = profitIfBackWins;
    else if (b.wl === "LAY WIN") brutoProfit = profitIfLayWins;
    else if (b.wl === "WIN") brutoProfit = Math.max(profitIfBackWins, profitIfLayWins);
    else if (b.wl === "LOSS") brutoProfit = Math.min(profitIfBackWins, profitIfLayWins);
  } else if (!hasBack && hasLay) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") brutoProfit = layStake;
    else if (b.wl === "LOSS" || b.wl === "BACK WIN") brutoProfit = -layLiability;
  } else if (hasBack && !hasLay) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") brutoProfit = backStake * (backOdds - 1);
    else if (b.wl === "LOSS" || b.wl === "LAY WIN") brutoProfit = -backStake;
  }
  return brutoProfit > 0 ? brutoProfit - komZnesek : brutoProfit;
}

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [todayStats, setTodayStats] = useState({ profit: 0, wins: 0, losses: 0, open: 0 });
  const [todayGames, setTodayGames] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    // --- SPREMEMBA: Samo enkrat pridobi podatke ob nalaganju ---
    fetchTodayStats();
    
    // Interval je ODSTRANJEN. Nič več avtomatskega osveževanja v ozadju.
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  async function fetchTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from("bets")
      .select("*")
      .eq("datum", today);

    if (data && !error) {
      setTodayGames(data);
      const stats = data.reduce((acc, bet) => {
        const p = calcProfit(bet);
        return {
          profit: acc.profit + p,
          wins: acc.wins + (["WIN", "BACK WIN", "LAY WIN"].includes(bet.wl) ? 1 : 0),
          losses: acc.losses + (bet.wl === "LOSS" ? 1 : 0),
          open: acc.open + (bet.wl === "OPEN" ? 1 : 0)
        };
      }, { profit: 0, wins: 0, losses: 0, open: 0 });
      setTodayStats(stats);
    }
  }

  const NavItem = ({ href, icon: Icon, label, variant = "default" }: any) => {
    const active = pathname === href;
    const isLogout = variant === "logout";

    return (
      <Link
        href={href}
        className={`
          group relative flex items-center gap-2.5 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300
          ${isLogout 
            ? "hover:bg-red-500/10 text-slate-400 hover:text-red-400" 
            : active 
            ? "text-white bg-green-500/10 border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]" 
            : "text-slate-400 hover:text-white hover:bg-white/5"}
        `}
      >
        <Icon className={`w-4 h-4 ${active && !isLogout ? "text-green-400" : ""}`} />
        <span className="hidden lg:inline">{label}</span>
      </Link>
    );
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-[100] transition-all duration-500 border-b ${
        scrolled
          ? "bg-[#0B1120]/90 backdrop-blur-xl border-slate-800/60 py-2 shadow-2xl"
          : "bg-transparent border-transparent py-4"
      }`}
    >
      <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between gap-6">
        
        {/* LOGO */}
        <Link href="/" className="shrink-0">
          <img
            src="/images/logo-full.png"
            alt="DD Tips"
            className={`w-auto object-contain transition-all duration-300 ${scrolled ? "h-12" : "h-20"}`}
          />
        </Link>

        {/* --- DANAŠNJE TEKME (TICKER) --- */}
        <div className="hidden xl:flex flex-1 overflow-hidden bg-slate-950/40 border border-white/5 rounded-2xl h-12 items-center shadow-inner">
          <div className="bg-emerald-500/10 px-4 h-full flex items-center border-r border-white/5 shrink-0">
            <div className="relative flex h-2 w-2 mr-2">
              {todayStats.open > 0 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${todayStats.open > 0 ? "bg-emerald-500" : "bg-slate-600"}`}></span>
            </div>
            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Danes</span>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <div className="flex animate-marquee whitespace-nowrap gap-12 hover:pause">
              {todayGames.length > 0 ? (
                todayGames.map((game, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="text-zinc-300 font-bold">{game.dogodek}</span>
                    <span className="text-emerald-500/80 font-medium px-2 py-0.5 bg-white/5 rounded">{game.tip}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      ["WIN", "BACK WIN", "LAY WIN"].includes(game.wl) ? "bg-emerald-500" : 
                      game.wl === "LOSS" ? "bg-rose-500" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                    }`} />
                  </div>
                ))
              ) : (
                <span className="text-xs text-zinc-600 italic pl-6">Danes še ni vpisanih dogodkov...</span>
              )}
            </div>
          </div>
        </div>

        {/* DANAŠNJI PROFIL */}
        <div className="hidden md:flex items-center gap-4 bg-slate-950/60 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
          <div className="px-3 py-1 flex flex-col items-center border-r border-white/10">
            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter leading-none mb-1">Profit</span>
            <span className={`text-sm font-mono font-black leading-none ${todayStats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {todayStats.profit >= 0 ? "+" : ""}{todayStats.profit.toFixed(2)}€
            </span>
          </div>
          <div className="flex gap-2 pr-2">
            <div className="flex flex-col items-center px-1" title="Zmage">
               <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">W</span>
               <span className="text-xs font-bold text-emerald-500">{todayStats.wins}</span>
            </div>
            <div className="flex flex-col items-center px-1" title="Izgube">
               <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">L</span>
               <span className="text-xs font-bold text-rose-500">{todayStats.losses}</span>
            </div>
            <div className="flex flex-col items-center px-1" title="Odprto">
               <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">O</span>
               <span className="text-xs font-bold text-amber-500">{todayStats.open}</span>
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="flex items-center p-1.5 rounded-full border border-white/5 bg-slate-950/30 backdrop-blur-md">
          <NavItem href="/" icon={Home} label="Home" />
          <NavItem href="/bets" icon={TrendingUp} label="Stave" />
          <NavItem href="/stats" icon={BarChart3} label="Statistika" />
          <div className="w-px h-6 bg-white/10 mx-2" />
          <NavItem href="/login" icon={LogOut} label="Odjava" variant="logout" />
        </nav>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(20%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 10s linear infinite;
        }
        .hover\:pause:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Spodnja črta ob skrolu */}
      <div className={`
        absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/50 to-transparent
        transition-opacity duration-500
        ${scrolled ? "opacity-100" : "opacity-0"}
      `} />
    </header>
  );
}