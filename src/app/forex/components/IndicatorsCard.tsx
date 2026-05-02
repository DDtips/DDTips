"use client";

import { useState } from "react";
import { CURRENCIES, type CurrencyCode } from "@/lib/forex/config";
import { EconomicIndicator } from "@/lib/forex/types";
import { BarChart3 } from "lucide-react";

interface IndicatorsCardProps {
  indicators: Record<CurrencyCode, EconomicIndicator[]>;
}

export default function IndicatorsCard({ indicators }: IndicatorsCardProps) {
  const [activeCurrency, setActiveCurrency] = useState<CurrencyCode>("USD");
  const currencyKeys = Object.keys(CURRENCIES) as CurrencyCode[];

  return (
    <div className="relative bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      <div className="relative p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-black uppercase tracking-wider text-white">
              Ekonomski podatki
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mt-0.5">
              CPI · GDP · Zaposlenost
            </p>
          </div>
        </div>

        {/* Currency tabs */}
        <div className="flex flex-wrap gap-2 mb-5 p-1.5 bg-black/40 rounded-2xl border border-white/5 w-fit">
          {currencyKeys.map((curr) => {
            const isActive = activeCurrency === curr;
            return (
              <button
                key={curr}
                onClick={() => setActiveCurrency(curr)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]"
                    : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                }`}
              >
                <span className="text-base">{CURRENCIES[curr].flag}</span>
                <span>{curr}</span>
              </button>
            );
          })}
        </div>

        {/* Tabela indikatorjev */}
        <div className="bg-black/40 rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    Indikator
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    Vrednost
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    YoY
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hidden sm:table-cell">
                    Datum
                  </th>
                </tr>
              </thead>
              <tbody>
                {(indicators[activeCurrency] || []).map((ind, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-bold text-white">
                      {ind.name}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-mono font-black text-white">
                      {ind.value !== null ? ind.value.toFixed(2) : "—"}
                      {ind.unit && (
                        <span className="text-emerald-400 ml-0.5">{ind.unit}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {ind.yoyChange !== null ? (
                        <span
                          className={`text-sm font-mono font-black ${
                            ind.yoyChange > 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {ind.yoyChange > 0 ? "+" : ""}
                          {ind.yoyChange.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-zinc-700 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-[10px] font-mono text-zinc-500 hidden sm:table-cell">
                      {ind.date || "—"}
                    </td>
                  </tr>
                ))}
                {(indicators[activeCurrency] || []).length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-zinc-600 text-xs font-bold uppercase tracking-wider italic"
                    >
                      Ni podatkov · Preveri FRED_API_KEY v .env.local
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
