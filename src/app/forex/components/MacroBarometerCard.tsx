"use client";
import React from "react";
import { AlertTriangle, Activity, TrendingUp, TrendingDown } from "lucide-react";

export default function MacroBarometerCard() {
  const isYieldInverted = true; // Simulirano stanje
  const spread = -0.35; 

  const indicators = [
    { name: "BAKER (Dr. Copper)", val: "$4.12", trend: "+1.2%", bull: true, desc: "Globalna rast" },
    { name: "NAFTA (WTI)", val: "$82.50", trend: "+2.4%", bull: true, desc: "Inflacijski pritisk" },
    { name: "USD/MXN (EM Risk)", val: "16.85", trend: "-0.5%", bull: false, desc: "Risk-On (MXN jača)" }
  ];

  return (
    <div className="p-5 rounded-2xl bg-[#121316] border border-white/5 w-full h-full flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-[13px] font-black text-white tracking-widest uppercase">Makro Barometer</h2>
          <p className="text-[9px] text-zinc-500 font-bold mt-1 tracking-wider uppercase">Surovine & Krivulja Donosnosti</p>
        </div>
      </div>

      {/* Warning Box za Recesijo */}
      <div className={`p-3 rounded-xl mb-4 flex items-start gap-3 border ${isYieldInverted ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
        <AlertTriangle className={`w-5 h-5 mt-0.5 ${isYieldInverted ? 'text-rose-400' : 'text-emerald-400'}`} />
        <div>
          <h3 className={`text-[10px] font-black uppercase tracking-widest ${isYieldInverted ? 'text-rose-400' : 'text-emerald-400'}`}>
            {isYieldInverted ? 'Recession Warning' : 'Normal Curve'}
          </h3>
          <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
            Spread (US10Y - US02Y) je <strong>{spread}%</strong>. Krivulja je inverzna, kar je močan zgodovinski indikator za recesijo.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {indicators.map((ind, i) => (
          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0b0e14] border border-white/5">
            <div>
              <span className="text-[10px] font-black text-white uppercase tracking-wider block">{ind.name}</span>
              <span className="text-[9px] text-zinc-500">{ind.desc}</span>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-xs font-mono font-bold text-white">{ind.val}</span>
              <div className={`flex items-center gap-1 text-[9px] font-bold ${ind.bull ? 'text-emerald-400' : 'text-rose-400'}`}>
                {ind.bull ? <TrendingUp className="w-2.5 h-2.5"/> : <TrendingDown className="w-2.5 h-2.5"/>}
                {ind.trend}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}