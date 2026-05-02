"use client";
import React from "react";
import { Flame, Feather, ArrowRight } from "lucide-react";

export default function ForwardGuidanceCard() {
  const banks = [
    { name: "FED", region: "ZDA", hawk: 65, status: "MILD HAWK", desc: "Višje za dlje" },
    { name: "ECB", region: "Evropa", hawk: 30, status: "DOVISH", desc: "Priprave na reze" },
    { name: "BOE", region: "UK", hawk: 50, status: "NEUTRAL", desc: "Čakanje na podatke" }
  ];

  return (
    <div className="p-5 rounded-2xl bg-[#121316] border border-white/5 w-full h-full flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-[13px] font-black text-white tracking-widest uppercase">Forward Guidance</h2>
          <p className="text-[9px] text-zinc-500 font-bold mt-1 tracking-wider uppercase">Pričakovanja politike (Hawk vs Dove)</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 flex-1 justify-center">
        {banks.map((b) => (
          <div key={b.name} className="flex flex-col gap-1.5 p-3 rounded-xl bg-[#0b0e14] border border-white/5 relative">
            <div className="flex justify-between items-end mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white">{b.name}</span>
                <span className="text-[9px] text-zinc-500 font-bold uppercase">{b.region}</span>
              </div>
              <span className={`text-[9px] font-black tracking-widest uppercase ${b.hawk > 55 ? 'text-rose-400' : b.hawk < 45 ? 'text-blue-400' : 'text-zinc-400'}`}>
                {b.status}
              </span>
            </div>
            
            {/* Merilnik */}
            <div className="relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden shadow-inner">
              <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-zinc-500 to-rose-500 w-full opacity-30" />
              <div className="absolute top-0 h-full w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] rounded-full transition-all duration-700" style={{ left: `${b.hawk}%` }} />
            </div>

            <div className="flex justify-between items-center mt-1">
              <div className="flex items-center gap-1 text-blue-400">
                <Feather className="w-3 h-3" />
                <span className="text-[8px] font-black uppercase tracking-widest">Dove</span>
              </div>
              <span className="text-[9px] text-zinc-400 font-medium">{b.desc}</span>
              <div className="flex items-center gap-1 text-rose-400">
                <span className="text-[8px] font-black uppercase tracking-widest">Hawk</span>
                <Flame className="w-3 h-3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}