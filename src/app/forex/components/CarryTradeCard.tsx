"use client";
import React from "react";
import { ArrowRightLeft, ShieldCheck, ShieldAlert } from "lucide-react";
import type { RiskIndicators } from "@/lib/forex/types";

interface CarryTradeCardProps {
  ratesData: { rates: Array<{ currency: string; rate: number }> };
  riskData: RiskIndicators;
}

export default function CarryTradeCard({ ratesData, riskData }: CarryTradeCardProps) {
  const getRate = (cur: string) => ratesData.rates.find((r) => r.currency === cur)?.rate || 0;
  
  const vix = riskData.vix.value;
  const isRiskOn = vix < 20; // Stabilno okolje je ključno za carry trade

  // Top carry trade pari (Kupiš valuto z visoko obrestjo, prodaš tisto z nizko)
  const opportunities = [
    { pair: "USD/JPY", long: "USD", short: "JPY", diff: getRate("USD") - getRate("JPY") },
    { pair: "GBP/JPY", long: "GBP", short: "JPY", diff: getRate("GBP") - getRate("JPY") },
    { pair: "EUR/JPY", long: "EUR", short: "JPY", diff: getRate("EUR") - getRate("JPY") },
  ].sort((a, b) => b.diff - a.diff);

  return (
    <div className="p-5 rounded-2xl bg-[#121316] border border-white/5 w-full h-full flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-[13px] font-black text-white tracking-widest uppercase">Carry Screener</h2>
          <p className="text-[9px] text-zinc-500 font-bold mt-1 tracking-wider uppercase">Obrestne Priložnosti</p>
        </div>
        <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
      </div>

      <div className={`mb-4 p-2.5 rounded-lg border flex items-start gap-2 ${isRiskOn ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
        {isRiskOn ? <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5" /> : <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5" />}
        <div>
          <h3 className={`text-[10px] font-black uppercase tracking-widest ${isRiskOn ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isRiskOn ? 'Risk-On (Ugodno)' : 'Risk-Off (Nevarno)'}
          </h3>
          <p className="text-[9px] text-zinc-400 mt-0.5 leading-tight">
            {isRiskOn ? "VIX je nizek. Kapital išče višje donose." : "Panika na trgu. Carry trade pozicije se množično zapirajo!"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {opportunities.map((opp, i) => (
          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0b0e14] border border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-black text-white tracking-wider">{opp.pair}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] font-mono font-bold text-emerald-400">+{opp.diff.toFixed(2)}%</span>
              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${isRiskOn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {isRiskOn ? 'BUY' : 'AVOID'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}