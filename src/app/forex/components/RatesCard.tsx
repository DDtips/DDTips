import { CentralBankRate } from "@/lib/forex/types";
import { Landmark } from "lucide-react";

interface RatesCardProps {
  rates: CentralBankRate[];
  differentials: Record<string, number>;
}

export default function RatesCard({ rates, differentials }: RatesCardProps) {
  return (
    <div className="relative bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
      {/* Subtilen gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      <div className="relative p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Landmark className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-black uppercase tracking-wider text-white">
              Obrestne mere
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mt-0.5">
              Centralne banke
            </p>
          </div>
        </div>

        {/* Posamezne obrestne mere */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {rates.map((rate) => (
            <div
              key={rate.currency}
              className="relative group bg-black/40 rounded-xl border border-white/5 p-4 hover:border-emerald-500/30 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-transparent transition-all duration-300" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{rate.flag}</span>
                  <div>
                    <div className="text-sm font-black text-white tracking-tight">
                      {rate.currency}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                      {rate.bank}
                    </div>
                  </div>
                </div>
                <div className="text-2xl md:text-3xl font-mono font-black text-white tracking-tighter">
                  {rate.rate.toFixed(2)}
                  <span className="text-emerald-400 ml-0.5">%</span>
                </div>
                {rate.source === "fallback" && (
                  <div className="text-[9px] font-bold uppercase tracking-wider text-amber-500/80 mt-1">
                    ⚠ fallback
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Rate Differentials */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
              Rate Differentials
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(differentials).map(([pair, diff]) => {
              const isPositive = diff > 0;
              const isNegative = diff < 0;
              const colorClass = isPositive
                ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                : isNegative
                ? "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                : "text-zinc-400";

              return (
                <div
                  key={pair}
                  className={`flex items-center justify-between bg-black/40 rounded-xl border px-4 py-3 transition-all ${
                    isPositive
                      ? "border-emerald-500/20"
                      : isNegative
                      ? "border-rose-500/20"
                      : "border-white/5"
                  }`}
                >
                  <span className="text-sm font-bold tracking-wide text-white">
                    {pair}
                  </span>
                  <span className={`text-base font-mono font-black tracking-tight ${colorClass}`}>
                    {diff > 0 ? "+" : ""}
                    {diff.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mt-4">
            ◆ Pozitivna razlika = bazna valuta ima višje obresti (običajno bullish bias)
          </p>
        </div>
      </div>
    </div>
  );
}
