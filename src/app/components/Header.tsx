"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, BarChart3, TrendingUp, Home } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// --- LOGIKA ZA PROFIT ---
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

// --- TIP ZA DROP (DEŽ) ---
type MoneyDrop = {
  id: number;
  left: number;       // Pozicija levo (0-100%)
  duration: number;   // Hitrost (sekunde)
  delay: number;      // Zamik (negativne številke za takojšen start)
  size: number;       // Velikost pisave
  opacity: number;    // Prosojnost
};

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [todayStats, setTodayStats] = useState({ profit: 0, wins: 0, losses: 0, open: 0 });
  const [todayGames, setTodayGames] = useState<any[]>([]);
  
  // State za generiran denar
  const [moneyDrops, setMoneyDrops] = useState<MoneyDrop[]>([]);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    fetchTodayStats();

    // --- GENERIRAJ RANDOM DENAR ---
    // Ustvarimo 50 "kapljic" denarja z naključnimi lastnostmi
    const drops = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,                   // Razporedi po celi širini
      duration: 3 + Math.random() * 5,             // Trajanje med 3s in 8s
      delay: -(Math.random() * 10),                // NEGATIVNI delay: animacija je že "v teku" ko prideš
      size: 16 + Math.random() * 24,               // Velikost med 16px in 40px
      opacity: 0.1 + Math.random() * 0.5           // Opacitarnost med 0.1 in 0.6
    }));
    setMoneyDrops(drops);
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  async function fetchTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from("bets").select("*").eq("datum", today);

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
      <Link href={href} className={`group relative flex items-center gap-2.5 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 ${isLogout ? "hover:bg-red-500/10 text-slate-400 hover:text-red-400" : active ? "text-white bg-green-500/10 border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
        <Icon className={`w-4 h-4 ${active && !isLogout ? "text-green-400" : ""}`} />
        <span className="hidden lg:inline">{label}</span>
      </Link>
    );
  };

  const getStatusBadge = (wl: string) => {
    if (["WIN", "BACK WIN", "LAY WIN"].includes(wl)) return <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">WIN</span>;
    if (wl === "LOSS") return <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400">LOSS</span>;
    if (wl === "VOID") return <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-500/10 border border-zinc-500/30 text-zinc-400">VOID</span>;
    return <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse">OPEN</span>;
  };

  const TickerContent = () => (
    <>
      {todayGames.length > 0 ? (
        todayGames.map((game, i) => (
          <div key={i} className="flex items-center gap-3 text-xs mx-6">
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wide border-r border-white/10 pr-3">{game.sport}</span>
            <span className="text-white font-bold">{game.dogodek}</span>
            <span className="text-zinc-400 mx-1">/</span>
            <span className="text-emerald-400 font-medium">{game.tip}</span>
            <div className="ml-2">{getStatusBadge(game.wl)}</div>
          </div>
        ))
      ) : (
        <span className="text-xs text-zinc-600 italic mx-12">Danes še ni vpisanih dogodkov...</span>
      )}
    </>
  );

  const showMoneyRain = todayStats.profit > 0;
  const isPositiveOrZero = todayStats.profit >= 0;

  return (
    <header className="fixed top-0 inset-x-0 z-[100] transition-all duration-500">
      
      {/* --- OZADJE HEADERJA (Premium Dark Mesh + RANDOM MONEY RAIN) --- */}
      <div className={`absolute inset-0 -z-10 transition-all duration-500 overflow-hidden ${scrolled ? 'backdrop-blur-xl border-b border-white/5' : 'backdrop-blur-sm border-b border-transparent'}`}>
         
         <div className={`absolute inset-0 bg-[#0B1120] transition-opacity duration-500 ${scrolled ? 'opacity-95' : 'opacity-90'}`} />
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />
         
         {/* Ambientne luči */}
         <div className="absolute top-[-100px] left-[10%] w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
         <div className="absolute top-[-100px] right-[10%] w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />

         {/* --- DYNAMIC RANDOM MONEY RAIN --- */}
         {showMoneyRain && mounted && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {moneyDrops.map((drop) => (
                <div
                  key={drop.id}
                  className="absolute bottom-[-50px] font-black text-emerald-400 animate-float-custom select-none"
                  style={{
                    left: `${drop.left}%`,
                    fontSize: `${drop.size}px`,
                    opacity: drop.opacity,
                    animationDuration: `${drop.duration}s`,
                    animationDelay: `${drop.delay}s`, // NEGATIVNI DELAY = TAKOJŠEN EFEKT
                    textShadow: '0 0 10px rgba(52, 211, 153, 0.5)' // Glow efekt
                  }}
                >
                  €
                </div>
              ))}
            </div>
         )}
      </div>

      <div className={`max-w-[1800px] mx-auto px-6 flex flex-col gap-5 transition-all duration-300 ${scrolled ? 'py-3' : 'py-5'}`}>
        
        {/* --- ZGORNJA VRSTICA --- */}
        <div className="w-full flex items-center justify-between gap-4">
            
            {/* 1. DANAŠNJI PROFIL */}
            <div className="hidden xl:flex flex-1 justify-center z-10">
                <div className={`
                    flex items-center gap-6 px-8 py-3 rounded-2xl border shadow-2xl relative overflow-hidden group transition-all duration-500
                    ml-0 
                    ${isPositiveOrZero
                        ? "bg-gradient-to-br from-emerald-950/80 via-[#0B1120] to-[#0B1120] border-emerald-500/40 shadow-[0_0_35px_-5px_rgba(16,185,129,0.3)]" 
                        : "bg-gradient-to-br from-rose-950/80 via-[#0B1120] to-[#0B1120] border-rose-500/30 shadow-[0_0_30px_-10px_rgba(244,63,94,0.3)]"}
                `}>
                  
                  {/* (Lokalni noise v okencu) */}
                  <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>

                  {/* Profit Content */}
                  <div className="flex flex-col items-center border-r border-white/10 pr-6 relative z-10">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">Danes</span>
                    <span className={`text-3xl font-mono font-black leading-none ${isPositiveOrZero ? "text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.8)]" : "text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]"}`}>
                      {todayStats.profit >= 0 ? "+" : ""}{todayStats.profit.toFixed(2)}€
                    </span>
                  </div>
                  <div className="flex gap-6 relative z-10">
                    <div className="flex flex-col items-center"><span className="text-[9px] font-black text-emerald-500/70 uppercase mb-0.5">WIN</span><span className="text-xl font-bold text-white">{todayStats.wins}</span></div>
                    <div className="flex flex-col items-center"><span className="text-[9px] font-black text-rose-500/70 uppercase mb-0.5">LOSS</span><span className="text-xl font-bold text-white">{todayStats.losses}</span></div>
                    <div className="flex flex-col items-center"><span className="text-[9px] font-black text-amber-500/70 uppercase mb-0.5">OPEN</span><span className="text-xl font-bold text-white">{todayStats.open}</span></div>
                  </div>
                </div>
            </div>

            {/* 2. NAVIGATION */}
            <nav className="shrink-0 flex items-center p-1.5 rounded-full border border-white/5 bg-slate-950/30 backdrop-blur-md z-20 shadow-lg">
              <NavItem href="/" icon={Home} label="Home" />
              <NavItem href="/bets" icon={TrendingUp} label="Stave" />
              <NavItem href="/stats" icon={BarChart3} label="Statistika" />
              <div className="w-px h-6 bg-white/10 mx-2" />
              <NavItem href="/login" icon={LogOut} label="Odjava" variant="logout" />
            </nav>
        </div>

        {/* --- SPODNJA VRSTICA: TICKER --- */}
        <div className="w-full overflow-hidden bg-slate-950/30 border border-white/5 rounded-xl h-10 flex items-center shadow-inner relative group">
          <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#0B1120] via-[#0B1120] to-transparent z-20 px-3 flex items-center">
             <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                <div className="relative flex h-1.5 w-1.5">
                  {todayStats.open > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${todayStats.open > 0 ? "bg-emerald-500" : "bg-slate-600"}`}></span>
                </div>
                <span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">Danes</span>
             </div>
          </div>

          <div className="w-full overflow-hidden relative min-w-0">
            <div className="flex w-max animate-marquee whitespace-nowrap hover:pause pl-24">
              <div className="flex items-center"><TickerContent /></div>
              <div className="flex items-center"><TickerContent /></div>
            </div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0B1120] to-transparent z-20 pointer-events-none" />
        </div>

      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes floatUp {
          0% { transform: translateY(100px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-120vh); opacity: 0; } /* Leti čez cel ekran navzgor */
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .animate-float-custom {
          animation-name: floatUp;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .hover\:pause:hover { animation-play-state: paused; }
      `}</style>

      <div className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/30 to-transparent transition-opacity duration-500 ${scrolled ? "opacity-100" : "opacity-0"}`} />
    </header>
  );
}