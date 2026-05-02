"use client";
import React from "react";
import { BarChart2 } from "lucide-react";

export default function CurrencyStrengthCard() {
  // Simulirani podatki za moč valute (0 do 10)
  const strengths = [
    { currency: "USD", score: 8.5, color: "bg-emerald-500" },
    { currency: "CHF", score: 7.2, color: "bg-emerald-400" },
    { currency: "GBP", score: 5.5, color: "bg-zinc-400" },
    { currency: "EUR", score: 4.1, color: "bg-rose-400" },
    { currency: "JPY", score: 2.0, color: "bg-rose-600" }
  ].sort((a, b) => b.score - a.score);

  return (
    <div className="p-5 rounded-2xl bg-[#121316] border border-white/5 w-full h-full flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-[13px] font-black text-white tracking-widest uppercase">Moč Valut (Heatmap)</h2>
          <p className="text-[9px] text-zinc-500 font-bold mt-1 tracking-wider uppercase">Dnevni Relativni Momentum</p>
        </div>
        <BarChart2 className="w-4 h-4 text-purple-500" />
      </div>

      <div className="flex flex-col gap-2.5 flex-1">
        {strengths.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[11px] font-black text-white w-8">{item.currency}</span>
            <div className="flex-1 h-3 bg-[#0b0e14] rounded-sm border border-white/5 overflow-hidden">
              <div 
                className={`h-full ${item.color} shadow-sm transition-all duration-1000`} 
                style={{ width: `${item.score * 10}%` }} 
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-zinc-400 w-6 text-right">
              {item.score.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t border-white/5 text-[9px] text-zinc-500 font-bold uppercase tracking-widest text-center">
        Tip: Kupuj {strengths[0].currency}, Prodaj {strengths[strengths.length-1].currency}
      </div>
    </div>
  );
}