"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, BarChart3, TrendingUp, Home, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// --- TIP ZA KAPLJICE DENARJA ---
type MoneyDrop = {
  id: number;
  left: number;       // Pozicija levo (0-100%)
  duration: number;   // Hitrost padanja
  delay: number;      // Zamik začetka
  size: number;       // Velikost simbola
  opacity: number;    // Prosojnost
};

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
    else if (b.wl === "LAY WIN") brutoProfit = layStake - backStake;
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
  
  // State za dež denarja
  const [moneyDrops, setMoneyDrops] = useState<MoneyDrop[]>([]);

  // Funkcija za pridobivanje podatkov
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

  useEffect(() => {
    // Če smo na login strani, ne delaj ničesar (optimizacija)
    if (pathname === "/login") return;

    setMounted(true);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    // 1. Prvi nalaganje podatkov
    fetchTodayStats();

    // 2. Generiranje kapljic
    const drops = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,                   
      duration: 3 + Math.random() * 4,             
      delay: -(Math.random() * 10),                
      size: 14 + Math.random() * 20,               
      opacity: 0.1 + Math.random() * 0.4           
    }));
    setMoneyDrops(drops);

    // 3. REALTIME LISTENER
    const channel = supabase
      .channel('header-bets-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bets' },
        (payload) => {
          console.log('Sprememba v bazi zaznana, osvežujem header...', payload);
          fetchTodayStats();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      supabase.removeChannel(channel);
    };
  }, [pathname]); // Dodal sem pathname v dependency array

  // --- KLJUČNA SPREMEMBA: SKRIVANJE HEADERA ---
  // Če je pot "/login", vrnemo null, kar pomeni, da se nič ne izriše.
  if (pathname === "/login") {
    return null;
  }
  // -------------------------------------------

  const NavItem = ({ href, icon: Icon, label }: any) => {
    const active = pathname === href;
    return (
      <Link href={href} className={`relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 group overflow-hidden ${active ? "bg-white/10 text-white shadow-lg border border-white/10" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}>
        <Icon className={`w-4 h-4 transition-colors ${active ? "text-emerald-400" : "group-hover:text-emerald-400"}`} />
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
        {active && <div className="absolute bottom-0 left-0 h-[2px] w-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />}
      </Link>
    );
  };

  const isPositive = todayStats.profit > 0;
  const isPositiveOrZero = todayStats.profit >= 0;

  return (
    <header className={`fixed top-0 inset-x-0 z-[100] transition-all duration-500 ${scrolled ? 'pt-0' : 'pt-4'}`}>
      
      {/* --- PREMIUM OZADJE + MONEY RAIN --- */}
      <div className={`absolute inset-0 -z-10 transition-all duration-500 overflow-hidden ${scrolled ? 'backdrop-blur-xl bg-black/80 border-b border-white/5' : 'backdrop-blur-sm bg-transparent border-b border-transparent'}`}>
         
         <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-transparent" />
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

         {/* EFEKT DENARJA */}
         {isPositive && mounted && (
            <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {moneyDrops.map((drop) => (
                <div
                  key={drop.id}
                  className="absolute top-[-50px] font-black text-emerald-500 select-none animate-money-fall"
                  style={{
                    left: `${drop.left}%`,
                    fontSize: `${drop.size}px`,
                    opacity: drop.opacity,
                    animationDuration: `${drop.duration}s`,
                    animationDelay: `${drop.delay}s`,
                    textShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  €
                </div>
              ))}
            </div>
         )}
      </div>

      <div className="max-w-[1800px] mx-auto px-6 flex flex-col gap-2 relative z-10">
        
        {/* --- GLAVNA VRSTICA --- */}
        <div className="relative flex items-center justify-between h-24">
            
            {/* LEVO: NAVIGACIJA */}
            <nav className="flex items-center gap-1">
                <div className="flex items-center p-1.5 bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-white/5 shadow-xl">
                    <NavItem href="/" icon={Home} label="Domov" />
                    <NavItem href="/bets" icon={TrendingUp} label="Stave" />
                    <NavItem href="/stats" icon={BarChart3} label="Statistika" />
                </div>
            </nav>

            {/* SREDINA: PROFIT (POVEČAN XL DESIGN) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                
                {/* Zunanji sijaj (Blur zadaj) */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[140%] blur-[80px] opacity-40 rounded-full pointer-events-none transition-colors duration-700 ${isPositiveOrZero ? 'bg-emerald-500/30' : 'bg-rose-500/30'}`} />

                {/* Glavna kartica */}
                <div className={`relative flex items-center gap-10 px-10 py-4 rounded-[2rem] border backdrop-blur-xl overflow-hidden transition-all duration-500 group ${isPositiveOrZero ? 'bg-black/60 border-emerald-500/20 shadow-[0_0_60px_-15px_rgba(16,185,129,0.3)]' : 'bg-black/60 border-rose-500/20 shadow-[0_0_60px_-15px_rgba(244,63,94,0.3)]'}`}>
                    
                    {/* Notranji gradient */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none" />
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay" />

                    {/* LEVA STRAN: ZNESEK */}
                    <div className="flex flex-col items-end pr-10 border-r border-white/10 relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full animate-pulse transition-colors duration-500 ${isPositiveOrZero ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`}></span>
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Profit Today</span>
                        </div>
                        <div className="flex items-center gap-3">
                             {/* Ikona puščice */}
                            <div className={`p-1.5 rounded-full border bg-opacity-10 ${isPositiveOrZero ? 'bg-emerald-500 border-emerald-500/30' : 'bg-rose-500 border-rose-500/30'}`}>
                                {isPositiveOrZero 
                                    ? <ArrowUpRight className="w-5 h-5 text-emerald-400" /> 
                                    : <ArrowDownRight className="w-5 h-5 text-rose-400" />
                                }
                            </div>
                            {/* Številka + Znak € */}
                            <span className={`text-4xl font-mono font-black tracking-tighter drop-shadow-xl text-white`}>
                                {todayStats.profit >= 0 ? "+" : ""}{todayStats.profit.toFixed(2)}
                                <span className={`ml-1 ${isPositiveOrZero ? "text-emerald-500" : "text-rose-500"}`}>€</span>
                            </span>
                        </div>
                    </div>

                    {/* DESNA STRAN: STATISTIKA */}
                    <div className="flex gap-3 relative z-10">
                        {/* WIN */}
                        <div className="flex flex-col items-center justify-center w-12 h-14 rounded-xl bg-zinc-900/50 border border-white/5 shadow-inner transition-transform hover:scale-105">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Win</span>
                            <span className="text-lg font-black text-emerald-400 drop-shadow-sm">{todayStats.wins}</span>
                        </div>
                        
                        {/* LOSS */}
                        <div className="flex flex-col items-center justify-center w-12 h-14 rounded-xl bg-zinc-900/50 border border-white/5 shadow-inner transition-transform hover:scale-105">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Loss</span>
                            <span className="text-lg font-black text-rose-400 drop-shadow-sm">{todayStats.losses}</span>
                        </div>
                        
                        {/* OPEN */}
                        <div className="flex flex-col items-center justify-center w-12 h-14 rounded-xl bg-zinc-900/50 border border-white/5 shadow-inner transition-transform hover:scale-105">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Open</span>
                            <span className="text-lg font-black text-amber-400 drop-shadow-sm">{todayStats.open}</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* DESNO: ODJAVA */}
            <div className="flex items-center">
                <Link href="/login" className="group relative flex items-center gap-2.5 px-6 py-2.5 rounded-xl bg-black/40 border border-white/5 overflow-hidden transition-all duration-300 hover:border-rose-500/40 hover:shadow-[0_0_25px_-5px_rgba(244,63,94,0.3)] active:scale-95">
                    <div className="absolute inset-0 bg-rose-500/0 group-hover:bg-rose-500/5 transition-colors duration-300" />
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    <span className="relative z-10 text-[11px] font-black text-zinc-500 group-hover:text-rose-400 uppercase tracking-[0.15em] transition-colors duration-300">
                        Odjava
                    </span>
                    <LogOut className="relative z-10 w-4 h-4 text-zinc-600 group-hover:text-rose-400 transition-colors duration-300 group-hover:-translate-x-0.5" />
                </Link>
            </div>
        </div>

        {/* --- SPODAJ: TICKER --- */}
        <div className={`relative h-7 w-full max-w-4xl mx-auto rounded-full overflow-hidden flex items-center transition-all duration-500 ${scrolled ? 'opacity-0 h-0' : 'opacity-100 bg-black/40 border border-white/5'}`}>
            <div className="absolute left-0 inset-y-0 px-4 flex items-center bg-gradient-to-r from-black via-black to-transparent z-20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-2 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Live</span>
            </div>
            
            <div className="flex w-max animate-marquee pl-24 whitespace-nowrap items-center hover:pause">
                {todayGames.length > 0 ? todayGames.map((g, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 text-[10px] border-r border-white/5 last:border-0">
                        <span className="text-zinc-500 font-bold uppercase">{g.sport}</span>
                        <span className="text-zinc-300 font-medium">{g.dogodek}</span>
                        <span className={`font-bold ${g.wl === 'WIN' ? 'text-emerald-400' : 'text-zinc-400'}`}>{g.tip}</span>
                    </div>
                )) : <span className="px-6 text-zinc-700 text-[9px] uppercase font-bold tracking-widest italic">Danes še ni vpisanih dogodkov...</span>}
            </div>
            
            <div className="absolute right-0 inset-y-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes moneyFall {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .animate-marquee { animation: marquee 40s linear infinite; }
        .animate-money-fall { 
            animation-name: moneyFall; 
            animation-timing-function: linear; 
            animation-iteration-count: infinite; 
        }
        .animate-shimmer {
            animation: shimmer 1s infinite;
        }
        .hover\:pause:hover { animation-play-state: paused; }
      `}</style>
    </header>
  );
}