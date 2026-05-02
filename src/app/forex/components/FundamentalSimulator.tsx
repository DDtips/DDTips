"use client";
import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, ShieldAlert, Flame, Activity } from "lucide-react";

export default function FundamentalSimulator() {
  const [fedPolicy, setFedPolicy] = useState(0); 
  const [usInflation, setUsInflation] = useState(0); 
  const [nfp, setNfp] = useState(0);
  const [geoRisk, setGeoRisk] = useState(0); 

  const [eurScore, setEurScore] = useState(0);
  const [xauScore, setXauScore] = useState(0);

  useEffect(() => {
    let eur = 0; let xau = 0;

    if (fedPolicy === 1) { eur -= 2; xau -= 2; } else if (fedPolicy === -1) { eur += 2; xau += 2; }
    if (usInflation === 1) { eur -= 1; xau += 1; } else if (usInflation === -1) { eur += 1; xau -= 1; }
    if (nfp === 1) { eur -= 1; xau -= 1; } else if (nfp === -1) { eur += 1; xau += 1; }
    if (geoRisk === 1) { eur -= 2; xau += 3; } 

    setEurScore(eur); setXauScore(xau);
  }, [fedPolicy, usInflation, nfp, geoRisk]);

  // Posodobljene ocene in teksti (točno kot na sliki)
  const getStyle = (score: number) => {
    if (score >= 2) return { text: "STRONG BULLISH (MOČNA RAST)", color: "text-emerald-400", bg: "bg-emerald-500", border: "border-emerald-500", glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]", pct: 85 };
    if (score > 0) return { text: "BULLISH (RAST)", color: "text-emerald-400", bg: "bg-emerald-500", border: "border-emerald-500", glow: "shadow-[0_0_10px_rgba(16,185,129,0.1)]", pct: 65 };
    if (score <= -2) return { text: "STRONG BEARISH (MOČAN PADEC)", color: "text-rose-400", bg: "bg-rose-500", border: "border-rose-500", glow: "shadow-[0_0_20px_rgba(244,63,94,0.15)]", pct: 15 };
    if (score < 0) return { text: "BEARISH (PADEC)", color: "text-rose-400", bg: "bg-rose-500", border: "border-rose-500", glow: "shadow-[0_0_10px_rgba(244,63,94,0.1)]", pct: 35 };
    return { text: "NEUTRAL (NEVTRALNO)", color: "text-zinc-400", bg: "bg-zinc-500", border: "border-zinc-500", glow: "", pct: 50 };
  };

  const eur = getStyle(eurScore); 
  const xau = getStyle(xauScore);

  const CustomToggle = ({ label, value, setter, icon1: I1, icon2: I2, icon3: I3, t1, t2, t3 }: any) => (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{label}</span>
      <div className="flex bg-[#0b0e14] rounded-lg border border-white/5 p-1 w-full">
        {t1 && <button onClick={() => setter(1)} className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-md transition-all ${value === 1 ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-600 hover:text-zinc-400'}`}><I1 className="w-3.5 h-3.5"/><span className="text-[9px] font-bold uppercase">{t1}</span></button>}
        {t2 && <button onClick={() => setter(0)} className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-md transition-all ${value === 0 ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-600 hover:text-zinc-400'}`}><I2 className="w-3.5 h-3.5"/><span className="text-[9px] font-bold uppercase">{t2}</span></button>}
        {t3 && <button onClick={() => setter(-1)} className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-md transition-all ${value === -1 ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-600 hover:text-zinc-400'}`}><I3 className="w-3.5 h-3.5"/><span className="text-[9px] font-bold uppercase">{t3}</span></button>}
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 rounded-2xl bg-[#121316] border border-white/5 w-full h-full flex flex-col relative overflow-hidden">
      
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-base font-black text-white tracking-wide flex items-center gap-2">
                Prototip: Fundamentalni Algoritem
            </h2>
        </div>
        <button onClick={() => { setFedPolicy(0); setUsInflation(0); setNfp(0); setGeoRisk(0); }}
          className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-wider transition-colors border border-white/5 px-3 py-1.5 rounded-lg bg-white/5">
          Ponastavi
        </button>
      </div>

      {/* Velike kartice točno kot na sliki */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        
        {/* EUR / USD Kartica */}
        <div className={`relative p-8 rounded-2xl bg-[#1a1b20] border-t-4 ${eur.border} ${eur.glow} transition-all duration-500 flex flex-col items-center justify-center min-h-[260px]`}>
            <h3 className="text-xl font-bold text-white mb-6">EUR / USD</h3>
            <div className="text-6xl text-white mb-10 font-light drop-shadow-lg">€</div>
            
            {/* Progress line + thumb */}
            <div className="w-[80%] h-1 bg-zinc-700 rounded-full relative mb-6">
                <div 
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${eur.bg} transition-all duration-700 ease-out shadow-lg`} 
                    style={{ left: `calc(${eur.pct}% - 8px)` }} 
                />
            </div>
            
            <div className={`px-4 py-1.5 rounded-full border ${eur.border} ${eur.color} text-[10px] font-bold tracking-widest uppercase bg-[#121316]`}>
                {eur.text}
            </div>
        </div>

        {/* Zlato Kartica */}
        <div className={`relative p-8 rounded-2xl bg-[#1a1b20] border-t-4 ${xau.border} ${xau.glow} transition-all duration-500 flex flex-col items-center justify-center min-h-[260px]`}>
            <h3 className="text-xl font-bold text-white mb-6">Zlato (XAU/USD)</h3>
            <div className="text-6xl text-white mb-10 font-light drop-shadow-lg flex items-center justify-center">
                💵
            </div>
            
            {/* Progress line + thumb */}
            <div className="w-[80%] h-1 bg-zinc-700 rounded-full relative mb-6">
                <div 
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${xau.bg} transition-all duration-700 ease-out shadow-lg`} 
                    style={{ left: `calc(${xau.pct}% - 8px)` }} 
                />
            </div>
            
            <div className={`px-4 py-1.5 rounded-full border ${xau.border} ${xau.color} text-[10px] font-bold tracking-widest uppercase bg-[#121316]`}>
                {xau.text}
            </div>
        </div>

      </div>

      <p className="text-center text-zinc-500 text-xs mb-6 font-medium">
        Prilagodite makro pogoje spodaj, da posodobite analizo.
      </p>

      {/* Kontrole z ikonami */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-auto">
        <CustomToggle label="Obresti FED" value={fedPolicy} setter={setFedPolicy} icon1={TrendingUp} t1="Dvig" icon2={Minus} t2="Drži" icon3={TrendingDown} t3="Niža" />
        <CustomToggle label="Inflacija" value={usInflation} setter={setUsInflation} icon1={Flame} t1="Raste" icon2={Minus} t2="Stabilna" icon3={TrendingDown} t3="Pada" />
        <CustomToggle label="Trg Dela (NFP)" value={nfp} setter={setNfp} icon1={TrendingUp} t1="Močan" icon2={Minus} t2="V Skladu" icon3={TrendingDown} t3="Šibek" />
        <CustomToggle label="Geopolitično Tveg." value={geoRisk} setter={setGeoRisk} icon1={ShieldAlert} t1="Visoko" icon2={Activity} t2="Nizko" />
      </div>
    </div>
  );
}