"use client";
import React from "react";
import { Users, ArrowLeftRight } from "lucide-react";

export default function RetailSentimentCard() {
  // Simulirani podatki (odstotek Retail traderjev, ki so LONG)
  const sentiment = [
    { pair: "EUR/USD", longPct: 78, signal: "SHORT" },
    { pair: "GBP/USD", longPct: 65, signal: "SHORT" },
    { pair: "XAU/USD", longPct: 20, signal: "LONG" }, // Zlato shortajo, kar je signal za rast
  ];

  return (
    <div className="p-5 rounded-2xl bg-[#121316] border border-white/5 w-full h-full flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-[13px] font-black text-white tracking-widest uppercase">Retail Sentiment</h2>
          <p className="text-[9px] text-zinc-500 font-bold mt-1 tracking-wider uppercase">Kontrarni (Pro) Signal</p>
        </div>
        <Users className="w-4 h-4 text-zinc-600" />
      </div>

      <div className="flex flex-col gap-4 flex-1 justify-center">
        {sentiment.map((s, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black text-white">{s.pair}</span>
              <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded border ${s.signal === 'LONG' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                Signal: {s.signal}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-emerald-400 w-8">{s.longPct}%</span>
              <div className="flex-1 h-2 bg-[#0b0e14] rounded-full overflow-hidden flex border border-white/5">
                <div className="h-full bg-emerald-500/80 transition-all" style={{ width: `${s.longPct}%` }} />
                <div className="h-full bg-rose-500/80 transition-all" style={{ width: `${100 - s.longPct}%` }} />
              </div>
              <span className="text-[9px] font-bold text-rose-400 w-8 text-right">{100 - s.longPct}%</span>
            </div>
            
            <div className="flex justify-between text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
              <span>Retail Long</span>
              <span>Retail Short</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}