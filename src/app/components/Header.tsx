"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, BarChart3, TrendingUp, Home, ArrowUpRight, ArrowDownRight, FileText, LineChart } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// --- TIP ZA KAPLJICE DENARJA ---
type MoneyDrop = {
  id: number;
  left: number;
  duration: number;
  delay: number;
  size: number;
  opacity: number;
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
  const [monthlyProfit, setMonthlyProfit] = useState(0); 
  const [todayGames, setTodayGames] = useState<any[]>([]);
  const [moneyDrops, setMoneyDrops] = useState<MoneyDrop[]>([]);

  // Funkcija za pridobivanje vseh statistik
  async function fetchStats() {
    const zdaj = new Date();
    const leto = zdaj.getFullYear();
    const mesec = zdaj.getMonth() + 1;
    const dan = zdaj.getDate();

    const danesString = `${leto}-${String(mesec).padStart(2, '0')}-${String(dan).padStart(2, '0')}`;
    const prviVMesecu = `${leto}-${String(mesec).padStart(2, '0')}-01`;

    // Danes
    const { data: dData } = await supabase.from("bets").select("*").eq("datum", danesString);
    if (dData) {
      setTodayGames(dData);
      const stats = dData.reduce((acc, bet) => ({
        profit: acc.profit + calcProfit(bet),
        wins: acc.wins + (["WIN", "BACK WIN", "LAY WIN"].includes(bet.wl) ? 1 : 0),
        losses: acc.losses + (bet.wl === "LOSS" ? 1 : 0),
        open: acc.open + (bet.wl === "OPEN" ? 1 : 0)
      }), { profit: 0, wins: 0, losses: 0, open: 0 });
      setTodayStats(stats);
    }

    // Mesec
    const { data: mData } = await supabase.from("bets").select("*").gte("datum", prviVMesecu);
    if (mData) {
      const total = mData.reduce((acc, bet) => acc + calcProfit(bet), 0);
      setMonthlyProfit(total);
    }
  }

  useEffect(() => {
    if (pathname === "/login") return;
    setMounted(true);
    fetchStats();

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    window.addEventListener("bets-updated", fetchStats);

    const channel = supabase.channel('header-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, fetchStats).subscribe();

    const drops = Array.from({ length: 60 }).map((_, i) => ({
      id: i, left: Math.random() * 100, duration: 3 + Math.random() * 4,
      delay: -(Math.random() * 10), size: 14 + Math.random() * 20, opacity: 0.1 + Math.random() * 0.4
    }));
    setMoneyDrops(drops);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("bets-updated", fetchStats);
      supabase.removeChannel(channel);
    };
  }, [pathname]);

  if (pathname === "/login") return null;

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

  const isPositiveOrZero = todayStats.profit >= 0;

  return (
    <>
      <header className={`fixed top-0 inset-x-0 z-[100] transition-all duration-500 pt-4`}>
        
        <div className={`absolute inset-0 -z-10 transition-all duration-500 overflow-hidden ${scrolled ? 'backdrop-blur-xl bg-black/80 border-b border-white/5 shadow-2xl' : 'backdrop-blur-sm bg-transparent border-b border-transparent'}`}>
          {todayStats.profit > 0 && mounted && (
              <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {moneyDrops.map((drop) => (
                  <div key={drop.id} className="absolute top-[-50px] font-black text-emerald-500 select-none animate-money-fall" style={{ left: `${drop.left}%`, fontSize: `${drop.size}px`, opacity: drop.opacity, animationDuration: `${drop.duration}s`, animationDelay: `${drop.delay}s`, textShadow: '0 0 15px rgba(16, 185, 129, 0.4)' }}>€</div>
                ))}
              </div>
          )}
        </div>

        <div className="max-w-[1800px] mx-auto px-4 md:px-6 flex flex-col gap-2 relative z-10">
          
          <div className="relative flex items-center justify-between h-20 md:h-24">
              
              {/* LEVA STRAN: Glavna Navigacija */}
              <nav className="hidden lg:flex items-center gap-1">
                  <div className="flex items-center p-1.5 bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-white/5 shadow-xl">
                      <NavItem href="/" icon={Home} label="Domov" />
                      <NavItem href="/bets" icon={TrendingUp} label="Stave" />
                      <NavItem href="/stats" icon={BarChart3} label="Statistika" />
                  </div>
              </nav>

              {/* SREDINA: PROFIT (DANES + MESEC) */}
              <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-500 scale-[0.65] sm:scale-75 md:scale-100 ${scrolled ? 'md:scale-75 opacity-90' : ''}`}>
                  
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[140%] blur-[80px] opacity-40 rounded-full pointer-events-none transition-colors duration-700 ${isPositiveOrZero ? 'bg-emerald-500/30' : 'bg-rose-500/30'}`} />

                  <div className={`relative flex items-center gap-6 md:gap-8 px-6 md:px-10 py-3 md:py-4 rounded-[2.5rem] border backdrop-blur-xl overflow-hidden transition-all duration-500 group ${isPositiveOrZero ? 'bg-black/60 border-emerald-500/20 shadow-[0_0_60px_-15px_rgba(16,185,129,0.3)]' : 'bg-black/60 border-rose-500/20 shadow-[0_0_60px_-15px_rgba(244,63,94,0.3)]'}`}>
                      
                      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none" />

                      {/* DANES */}
                      <div className="flex flex-col items-center pr-6 md:pr-8 border-r border-white/10 relative z-10">
                          <div className="flex items-center gap-1.5 mb-1">
                              <span className={`w-2 h-2 rounded-full animate-pulse ${isPositiveOrZero ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
                              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Today</span>
                          </div>
                          <span className={`text-3xl md:text-4xl font-mono font-black tracking-tighter drop-shadow-xl text-white whitespace-nowrap`}>
                              {todayStats.profit >= 0 ? "+" : ""}{todayStats.profit.toFixed(2)}€
                          </span>
                      </div>

                      {/* MESEC */}
                      <div className="flex flex-col items-center pr-6 md:pr-8 border-r border-white/10 relative z-10">
                          <div className="flex items-center gap-1.5 mb-1">
                              {monthlyProfit >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-rose-400" />}
                              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Month</span>
                          </div>
                          <span className={`text-3xl md:text-4xl font-mono font-black tracking-tighter drop-shadow-xl whitespace-nowrap ${monthlyProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                             {monthlyProfit >= 0 ? "+" : ""}{monthlyProfit.toFixed(2)}€
                          </span>
                      </div>

                      {/* STATS (Win/Loss) */}
                      <div className="flex gap-2 relative z-10">
                          {['Win', 'Loss'].map((label) => (
                              <div key={label} className="flex flex-col items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl bg-zinc-900/50 border border-white/5">
                                  <span className="text-[8px] font-bold text-zinc-500 uppercase">{label}</span>
                                  <span className={`text-base font-black ${label==='Win'?'text-emerald-400':'text-rose-400'}`}>
                                      {label==='Win'?todayStats.wins:todayStats.losses}
                                  </span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              {/* DESNA STRAN: Poročila, Forex, Odjava */}
              <div className="flex items-center gap-2 md:gap-3 ml-auto lg:ml-0 z-30">
                  
                  {/* Poročila */}
                  <Link href="/porocila" className={`group relative flex items-center justify-center gap-2 px-3 py-2.5 md:px-5 md:py-2.5 rounded-xl border overflow-hidden transition-all duration-300 ${pathname === "/porocila" ? "bg-emerald-500/20 border-emerald-500/40" : "bg-black/40 border-white/5 hover:border-emerald-500/40"}`}>
                      <FileText className={`relative z-10 w-4 h-4 ${pathname === "/porocila" ? "text-emerald-400" : "text-zinc-400 group-hover:text-emerald-400"}`} />
                      <span className="relative z-10 text-[11px] font-black uppercase tracking-[0.1em] text-zinc-300 hidden md:block">Poročila</span>
                  </Link>

                  {/* Forex */}
                  <Link href="/forex" className={`group relative flex items-center justify-center gap-2 px-3 py-2.5 md:px-5 md:py-2.5 rounded-xl border overflow-hidden transition-all duration-300 ${pathname === "/forex" ? "bg-emerald-500/20 border-emerald-500/40" : "bg-black/40 border-white/5 hover:border-emerald-500/40"}`}>
                      <LineChart className={`relative z-10 w-4 h-4 ${pathname === "/forex" ? "text-emerald-400" : "text-zinc-400 group-hover:text-emerald-400"}`} />
                      <span className="relative z-10 text-[11px] font-black uppercase tracking-[0.1em] text-zinc-300 hidden md:block">Forex</span>
                  </Link>

                  {/* Odjava (Samo Ikona) */}
                  <Link href="/login" title="Odjava" className="group flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-xl bg-black/40 border border-white/5 hover:border-rose-500/40 hover:bg-rose-500/10 transition-all duration-300">
                      <LogOut className="w-4 h-4 text-zinc-400 group-hover:text-rose-400" />
                  </Link>
              </div>
          </div>

          {/* TICKER */}
          <div className="relative h-9 w-full max-w-4xl mx-auto rounded-full overflow-hidden flex items-center bg-black/40 border border-white/5">
              <div className="absolute left-0 inset-y-0 px-5 flex items-center bg-black z-20">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2.5" />
                  <span className="text-[10px] font-black uppercase text-zinc-300">LIVE</span>
              </div>
              <div className="flex w-max animate-marquee pl-24 whitespace-nowrap items-center">
                  {todayGames.length > 0 ? todayGames.map((g, i) => (
                      <div key={i} className={`flex items-center gap-3 px-6 text-[11px] border-r border-white/5 last:border-0 font-bold tracking-wide ${g.wl.includes('WIN') ? 'text-emerald-400' : g.wl === 'LOSS' ? 'text-rose-400' : 'text-zinc-500'}`}>
                          <span className="uppercase opacity-70">{g.sport}</span>
                          <span>{g.dogodek}</span>
                      </div>
                  )) : <span className="px-6 text-zinc-600 text-[10px] uppercase italic">Čakam na današnje vpise...</span>}
              </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          @keyframes moneyFall { 0% { transform: translateY(-50px) rotate(0deg); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 0.8; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
          .animate-marquee { animation: marquee 40s linear infinite; }
          .animate-money-fall { animation-name: moneyFall; animation-timing-function: linear; animation-iteration-count: infinite; }
        `}</style>
      </header>

      {/* MOBILE NAV (Spodaj na telefonih) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[150] bg-black/80 backdrop-blur-xl border-t border-white/10 h-16 shadow-[0_-10px_40px_-15px_rgba(0,0,0,1)]">
        <div className="flex justify-around items-center h-full px-2">
           <Link href="/" className={`flex flex-col items-center gap-1 ${pathname === "/" ? "text-emerald-400" : "text-zinc-500"}`}><Home className="w-5 h-5" /><span className="text-[9px] font-bold uppercase">Domov</span></Link>
           <Link href="/bets" className={`flex flex-col items-center gap-1 ${pathname === "/bets" ? "text-emerald-400" : "text-zinc-500"}`}><TrendingUp className="w-5 h-5" /><span className="text-[9px] font-bold uppercase">Stave</span></Link>
           <Link href="/forex" className={`flex flex-col items-center gap-1 ${pathname === "/forex" ? "text-emerald-400" : "text-zinc-500"}`}><LineChart className="w-5 h-5" /><span className="text-[9px] font-bold uppercase">Forex</span></Link>
           <Link href="/porocila" className={`flex flex-col items-center gap-1 ${pathname === "/porocila" ? "text-emerald-400" : "text-zinc-500"}`}><FileText className="w-5 h-5" /><span className="text-[9px] font-bold uppercase">Poročila</span></Link>
           <Link href="/stats" className={`flex flex-col items-center gap-1 ${pathname === "/stats" ? "text-emerald-400" : "text-zinc-500"}`}><BarChart3 className="w-5 h-5" /><span className="text-[9px] font-bold uppercase">Stats</span></Link>
        </div>
      </nav>
    </>
  );
}