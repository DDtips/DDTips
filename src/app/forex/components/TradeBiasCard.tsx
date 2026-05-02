"use client";
import React from "react";
import { 
  TrendingUp, TrendingDown, ShieldAlert, Activity, DollarSign, Globe, Scale, 
  Factory, Users, Flame, Feather 
} from "lucide-react";
import type { EconomicIndicator, RiskIndicators } from "@/lib/forex/types";

interface TradeBiasCardProps {
  indicatorsData: Record<string, EconomicIndicator[]>;
  ratesData: { rates: Array<{ currency: string; rate: number }> };
  riskData: RiskIndicators;
}

export default function TradeBiasCard({ indicatorsData, ratesData, riskData }: TradeBiasCardProps) {
  // --- 1. PRIDOBIVANJE MAKRO PODATKOV ---
  const getRate = (cur: string) => ratesData.rates.find((r) => r.currency === cur)?.rate || 0;
  const usdRate = getRate("USD");
  const eurRate = getRate("EUR");
  const gbpRate = getRate("GBP");
  const jpyRate = getRate("JPY");
  const audRate = getRate("AUD");

  const usIndicators = indicatorsData["USD"] || [];
  const usCpi = usIndicators.find((i) => i.name.includes("CPI"))?.yoyChange || 0;
  const usPmi = usIndicators.find((i) => i.name.includes("PMI") || i.name.includes("ISM"))?.value || 50;
  const usRealRate = usdRate - usCpi;

  const dxyTrend = riskData.dxy.change; 
  const vixSentiment = riskData.vix.sentiment; 
  
  // --- 2. SIMULACIJA PREMIUM PODATKOV (Retail & Forward Guidance) ---
  const geopoliticsStatus: "LOW" | "HIGH" = "HIGH";

  // Forward Guidance (Kaj banke govorijo: 1 = Hawk/Višanje, -1 = Dove/Nižanje, 0 = Nevtralno)
  const cbTone = {
    FED: 1,   // Mild Hawk
    ECB: -1,  // Dovish
    BOE: 0,   // Neutral
    RBA: 1,   // Hawk
    BOJ: -1   // Dovish
  };

  // Retail Sentiment (% amaterjev, ki so LONG. > 70% = močan SHORT signal, < 30% = močan LONG signal)
  const retailLongPct = {
    "EUR/USD": 78, 
    "GBP/USD": 65,
    "AUD/USD": 55,
    "USD/JPY": 35, 
    "XAU/USD": 20  
  };

  // --- 3. MASTER ALGORITHM (Analitika) ---
  const analyze = (pair: string) => {
    let score = 0;
    const tags: { label: string; positive: boolean; icon: any }[] = [];

    if (pair === "DXY") {
      if (usdRate >= 5.0) { score += 1; tags.push({ label: "Visoke obresti", positive: true, icon: TrendingUp }); }
      if (cbTone.FED > 0) { score += 1; tags.push({ label: "FED Hawkish", positive: true, icon: Flame }); }
      if (usPmi > 50) { score += 1; tags.push({ label: "Gosp. rast", positive: true, icon: Factory }); }
      if (geopoliticsStatus === "HIGH") { score += 2; tags.push({ label: "Varna Luka", positive: true, icon: ShieldAlert }); }
      if (vixSentiment === "risk-off") { score += 1; tags.push({ label: "Panika (VIX)", positive: true, icon: Activity }); }
    }

    if (pair === "EUR/USD") {
      if (eurRate > usdRate) { score += 1; tags.push({ label: "ECB > FED", positive: true, icon: Scale }); } 
      else { score -= 1; tags.push({ label: "FED > ECB", positive: false, icon: Scale }); }
      
      if (cbTone.ECB < 0) { score -= 1; tags.push({ label: "ECB Dovish", positive: false, icon: Feather }); }
      if (cbTone.FED > 0) { score -= 1; tags.push({ label: "FED Hawkish", positive: false, icon: Flame }); }
      
      if (retailLongPct["EUR/USD"] > 70) { score -= 2; tags.push({ label: "Retail kmetje so LONG", positive: false, icon: Users }); }
      
      if (dxyTrend > 0) { score -= 1; tags.push({ label: "Močan USD", positive: false, icon: DollarSign }); }
      if (geopoliticsStatus === "HIGH") { score -= 1; tags.push({ label: "Beg iz EUR", positive: false, icon: Globe }); }
    }

    if (pair === "GBP/USD") {
      if (gbpRate > usdRate) { score += 1; tags.push({ label: "BOE > FED", positive: true, icon: Scale }); } 
      else { score -= 1; tags.push({ label: "FED > BOE", positive: false, icon: Scale }); }
      
      if (cbTone.FED > 0) { score -= 1; tags.push({ label: "FED Hawkish", positive: false, icon: Flame }); }
      if (retailLongPct["GBP/USD"] > 60) { score -= 1; tags.push({ label: "Retail prodaja", positive: false, icon: Users }); }
      if (dxyTrend > 0) { score -= 1; tags.push({ label: "Močan USD", positive: false, icon: DollarSign }); }
    }

    if (pair === "AUD/USD") {
      if (audRate > usdRate) { score += 1; tags.push({ label: "RBA > FED", positive: true, icon: Scale }); } 
      else { score -= 1; tags.push({ label: "FED > RBA", positive: false, icon: Scale }); }
      
      if (cbTone.RBA > 0) { score += 1; tags.push({ label: "RBA Hawkish", positive: true, icon: Flame }); }
      if (usPmi > 50) { score += 1; tags.push({ label: "Globalna rast", positive: true, icon: Globe }); }
      if (vixSentiment === "risk-on") { score += 1; tags.push({ label: "Risk-On okolje", positive: true, icon: TrendingUp }); }
      if (vixSentiment === "risk-off") { score -= 2; tags.push({ label: "Risk-Off padec", positive: false, icon: TrendingDown }); }
    }

    if (pair === "USD/JPY") {
      if (geopoliticsStatus === "HIGH") { score -= 2; tags.push({ label: "JPY varna luka", positive: false, icon: ShieldAlert }); }
      if (usdRate > jpyRate + 4) { score += 1; tags.push({ label: "Carry Trade", positive: true, icon: Activity }); }
      if (cbTone.BOJ < 0) { score += 1; tags.push({ label: "BOJ Dovish", positive: true, icon: Feather }); }
      if (retailLongPct["USD/JPY"] < 40) { score += 1; tags.push({ label: "Retail shorta", positive: true, icon: Users }); }
      if (dxyTrend > 0) { score += 1; tags.push({ label: "Močan USD", positive: true, icon: DollarSign }); }
    }

    if (pair === "XAU/USD") {
      if (usRealRate < 1.0) { score += 2; tags.push({ label: "Nizke realne obr.", positive: true, icon: TrendingDown }); } 
      else { score -= 1; tags.push({ label: "Visoke realne obr.", positive: false, icon: TrendingUp }); }
      
      if (retailLongPct["XAU/USD"] < 30) { score += 2; tags.push({ label: "Smart Money Long", positive: true, icon: Users }); }
      if (cbTone.FED > 0) { score -= 1; tags.push({ label: "FED Hawkish", positive: false, icon: Flame }); }
      
      if (geopoliticsStatus === "HIGH") { score += 2; tags.push({ label: "Kriza (Zlato)", positive: true, icon: ShieldAlert }); }
      if (vixSentiment === "risk-off") { score += 1; tags.push({ label: "Panika (VIX)", positive: true, icon: Activity }); }
    }

    return { score, tags };
  };

  const assets = [
    { id: "DXY", title: "U.S. DOLLAR", subtitle: "DXY Indeks", symbol: "💲" },
    { id: "EUR/USD", title: "EUR / USD", subtitle: "Glavni Par", symbol: "€" },
    { id: "GBP/USD", title: "GBP / USD", subtitle: "Funt / Dolar", symbol: "£" },
    { id: "AUD/USD", title: "AUD / USD", subtitle: "Surovine & Risk", symbol: "A$" },
    { id: "USD/JPY", title: "USD / JPY", subtitle: "Carry & Safe Haven", symbol: "¥" },
    { id: "XAU/USD", title: "ZLATO", subtitle: "Plemenite kovine", symbol: "🪙" },
  ];

  // --- 4. VIZUALNA KOMPONENTA KARTICE ---
  const BiasDisplay = ({ asset }: { asset: any }) => {
    const { score, tags } = analyze(asset.id);
    
    let biasText = "NEVTRALNO";
    let colorClass = "text-zinc-400";
    let barColor = "from-zinc-500 to-zinc-400";
    let borderClass = "border-zinc-500/20";
    let pct = 50;

    if (score >= 3) { biasText = "STRONG BULL"; colorClass = "text-emerald-400"; barColor = "from-emerald-500 to-emerald-400"; borderClass = "border-emerald-500"; pct = 90; }
    else if (score > 0) { biasText = "BULLISH"; colorClass = "text-emerald-500"; barColor = "from-emerald-600 to-emerald-500"; borderClass = "border-emerald-500/50"; pct = 65; }
    else if (score <= -3) { biasText = "STRONG BEAR"; colorClass = "text-rose-400"; barColor = "from-rose-500 to-rose-400"; borderClass = "border-rose-500"; pct = 10; }
    else if (score < 0) { biasText = "BEARISH"; colorClass = "text-rose-500"; barColor = "from-rose-600 to-rose-500"; borderClass = "border-rose-500/50"; pct = 35; }

    return (
      <div className={`relative p-5 rounded-2xl bg-[#1a1b20] border-t-2 ${borderClass} shadow-lg transition-all duration-300 flex flex-col min-h-[160px] overflow-hidden group`}>
        
        <div className="absolute -right-4 -bottom-4 text-8xl font-black text-white/[0.03] group-hover:text-white/[0.05] transition-colors pointer-events-none select-none">
          {asset.symbol}
        </div>

        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <h3 className="text-[13px] font-black text-white tracking-wider">{asset.title}</h3>
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{asset.subtitle}</span>
          </div>
          <div className={`text-[10px] font-black tracking-widest uppercase ${colorClass}`}>
            {biasText}
          </div>
        </div>

        <div className="w-full h-1.5 bg-[#0b0e14] rounded-full relative mb-4 shadow-inner border border-white/5 z-10">
           <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 bg-gradient-to-r ${barColor}`} style={{ width: `${pct}%` }} />
           <div className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-700`} style={{ left: `calc(${pct}% - 6px)` }} />
        </div>

        <div className="flex flex-wrap gap-1.5 mt-auto relative z-10">
          {tags.length > 0 ? tags.map((t, i) => (
            <div key={i} className={`flex items-center gap-1 px-1.5 py-1 rounded w-fit border shadow-sm ${t.positive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              <t.icon className="w-3 h-3" />
              <span className="text-[9px] font-black uppercase tracking-wider">{t.label}</span>
            </div>
          )) : <span className="text-[10px] text-zinc-600 font-bold tracking-widest uppercase">Nevtralno okolje</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 rounded-3xl bg-[#121316] border border-white/5 w-full h-full flex flex-col relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
            <h2 className="text-sm font-black text-white tracking-widest uppercase">Master Algorithm Bias</h2>
            <p className="text-[10px] text-zinc-500 font-bold mt-1 tracking-wider uppercase">Združuje: Makro • Forward Guidance • Geopolitiko • Retail Sentiment</p>
        </div>
        <span className="text-[9px] uppercase font-black tracking-widest bg-purple-500/10 text-purple-400 px-3 py-1 rounded-md border border-purple-500/20">
          Pro Model
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 relative z-10">
        {assets.map((asset) => (
          <BiasDisplay key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
}