"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Building2, Wallet } from "lucide-react";

// --- KONFIGURACIJA ---
const BOOK_START: Record<string, number> = {
  SHARP: 2000, PINNACLE: 2000, BET365: 2000, WINAMAX: 1000, WWIN: 500, "E-STAVE": 500, "BET AT HOME": 1000,
};

function normBook(x: string) { return (x || "").toUpperCase().replace(/\s+/g, "").replace(/-/g, ""); }
function eur(n: number) { return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR" }); }

// Helpers za profit (kopiraj isto logiko kot v Home)
function calcProfit(b: any) {
    if (b.wl !== "WIN" && b.wl !== "LOSS") return 0;
    const kom = b.komisija || 0;
    const backStake = b.vplacilo1 || 0; const backOdds = b.kvota1 || 0;
    const layStake = b.vplacilo2 || 0; const layOdds = b.lay_kvota || 0;
    const liability = (layOdds - 1) * layStake;
    
    // Logic shorthand
    const hasBack = backStake > 0; const hasLay = layStake > 0;
    if (hasBack && !hasLay) return b.wl === "WIN" ? backStake * (backOdds - 1) - kom : -backStake - kom;
    if (!hasBack && hasLay) return b.wl === "WIN" ? layStake - kom : -liability - kom;
    if (hasBack && hasLay) return b.wl === "WIN" ? (backStake * (backOdds - 1)) - liability - kom : -backStake + layStake - kom;
    return 0;
}

export default function StatsPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("bets").select("*");
      setRows(data || []);
    })();
  }, []);

  const stats = useMemo(() => {
    const settled = rows.filter(r => r.wl === "WIN" || r.wl === "LOSS");
    const profitByBook = new Map<string, number>();
    
    settled.forEach(r => {
      const k = normBook(r.stavnica);
      profitByBook.set(k, (profitByBook.get(k) || 0) + calcProfit(r));
    });

    const balanceByBook: any[] = [];
    Object.entries(BOOK_START).forEach(([name, start]) => {
      const p = profitByBook.get(normBook(name)) || 0;
      balanceByBook.push({ name, start, profit: p, balance: start + p });
    });
    
    // Sortiraj po največjem stanju
    return balanceByBook.sort((a, b) => b.balance - a.balance);
  }, [rows]);

  const totalBank = stats.reduce((acc, curr) => acc + curr.balance, 0);

  return (
    <main className="min-h-screen pt-24 pb-12 px-4 md:px-8 bg-black">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">Analitika & Stavnice</h1>
          <p className="text-zinc-400">Podroben pregled kapitala po posameznih stavnicah.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEVI STOLPEC - GRAF RASTI (poenostavljen placeholder) */}
          <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-6 backdrop-blur-md">
            <h3 className="font-bold text-white mb-6 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-500" /> 
              Skupna Banka: <span className="text-emerald-400 text-xl">{eur(totalBank)}</span>
            </h3>
            {/* Tukaj lahko uporabiš enak Chart kot na Home, le večji */}
            <div className="h-[400px] flex items-center justify-center border border-dashed border-zinc-800 rounded-2xl">
               <span className="text-zinc-500">Graf Rasti Profita</span>
            </div>
          </div>

          {/* DESNI STOLPEC - STANJE STAVNIC (To si želel) */}
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-6 backdrop-blur-md flex flex-col h-full">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-zinc-800/50">
              <div className="p-2 bg-violet-500/10 rounded-lg text-violet-500"><Building2 className="w-5 h-5"/></div>
              <h2 className="font-bold text-white">Stanje Stavnic</h2>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {stats.map((book) => {
                const isProfit = book.profit >= 0;
                const percent = (book.profit / book.start) * 100;
                
                return (
                  <div key={book.name} className="group p-4 bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700 rounded-2xl transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-zinc-300">{book.name}</span>
                      <span className="font-mono text-sm font-bold text-white">{eur(book.balance)}</span>
                    </div>
                    
                    {/* Progress Bar background */}
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-2">
                      {/* Vizualizacija - koliko je polna glede na start */}
                      <div 
                        className={`h-full rounded-full ${isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                        style={{ width: `${Math.min((book.balance / (book.start * 1.5)) * 100, 100)}%` }} 
                      />
                    </div>

                    <div className="flex justify-between text-[10px] uppercase tracking-wider font-medium">
                      <span className="text-zinc-500">Start: {eur(book.start)}</span>
                      <span className={isProfit ? "text-emerald-400" : "text-rose-400"}>
                        {isProfit ? "+" : ""}{eur(book.profit)} ({percent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}