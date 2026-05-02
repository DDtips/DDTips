"use client";
import React from "react";
import { Landmark } from "lucide-react";

export default function CotReportCard() {
  // Simulirani COT podatki (Smart Money / Institutions)
  const cotData = [
    { asset: "USD", long: 72, signal: "BULLISH" },
    { asset: "EUR", long: 35, signal: "BEARISH" },
    { asset: "JPY", long: 15, signal: "EXTREME SHORT" },
    { asset: "GOLD", long: 85, signal: "EXTREME LONG" }
  ];

  return (
    <div className="p-5 rounded-2xl bg-[#121316] border border-white/5 w-full h-full flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-[13px] font-black text-white tracking-widest uppercase">Smart Money Flow</h2>
          <p className="text-[9px] text-zinc-500 font-bold mt-1 tracking-wider uppercase">C.O.T. Institucionalne Pozicije</p>
        </div>
        <Landmark className="w-4 h-4 text-blue-500" />
      </div>

      <div className="flex flex-col gap-4 flex-1 justify-center">
        {cotData.map((s, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black text-white">{s.asset}</span>
              <span className={`text-[8px] font-black tracking-widest uppercase ${s.long > 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {s.signal}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-zinc-400 w-6">L</span>
              <div className="flex-1 h-1.5 bg-[#0b0e14] rounded-full overflow-hidden flex border border-white/5">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${s.long}%` }} />
                <div className="h-full bg-zinc-700 transition-all" style={{ width: `${100 - s.long}%` }} />
              </div>
              <span className="text-[9px] font-mono text-zinc-400 w-6 text-right">S</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}