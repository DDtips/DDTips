import { PairPrice } from "@/lib/forex/types";
import { ArrowUpRight, ArrowDownRight, DollarSign } from "lucide-react";

interface PricesCardProps {
  prices: PairPrice[];
}

export default function PricesCard({ prices }: PricesCardProps) {
  return (
    <div className="relative bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      <div className="relative p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-black uppercase tracking-wider text-white">
              Cene parov
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mt-0.5">
              Live · Yahoo Finance
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {prices.map((p) => {
            const isUp = (p.changePct ?? 0) > 0;
            const isDown = (p.changePct ?? 0) < 0;
            const isPositiveOrZero = (p.changePct ?? 0) >= 0;

            return (
              <div
                key={p.pair}
                className="relative group bg-black/40 rounded-2xl border border-white/5 p-5 overflow-hidden transition-all duration-500 hover:border-emerald-500/20"
              >
                {/* Glow efekt */}
                <div
                  className={`absolute -top-10 -right-10 w-32 h-32 blur-3xl rounded-full opacity-30 transition-opacity duration-500 ${
                    isPositiveOrZero ? "bg-emerald-500/40" : "bg-rose-500/40"
                  }`}
                />

                <div className="relative">
                  {/* Pair label */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                      {p.pair}
                    </span>
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${
                        isUp
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : isDown
                          ? "bg-rose-500/10 border-rose-500/30"
                          : "bg-zinc-700/30 border-white/5"
                      }`}
                    >
                      {isUp ? (
                        <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                      ) : isDown ? (
                        <ArrowDownRight className="w-3 h-3 text-rose-400" />
                      ) : null}
                      <span
                        className={`text-[10px] font-mono font-black ${
                          isUp
                            ? "text-emerald-400"
                            : isDown
                            ? "text-rose-400"
                            : "text-zinc-400"
                        }`}
                      >
                        {p.changePct !== null
                          ? `${isUp ? "+" : ""}${p.changePct.toFixed(2)}%`
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Cena */}
                  <div className="text-3xl md:text-4xl font-mono font-black text-white tracking-tighter drop-shadow-xl mb-3">
                    {p.price !== null
                      ? p.price.toFixed(p.pair === "USD/JPY" ? 2 : 4)
                      : "—"}
                  </div>

                  {/* High / Low */}
                  {p.high24h !== null && p.low24h !== null && (
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                      <span>
                        H:{" "}
                        <span className="text-zinc-400 font-mono">
                          {p.high24h.toFixed(p.pair === "USD/JPY" ? 2 : 4)}
                        </span>
                      </span>
                      <span className="text-zinc-700">·</span>
                      <span>
                        L:{" "}
                        <span className="text-zinc-400 font-mono">
                          {p.low24h.toFixed(p.pair === "USD/JPY" ? 2 : 4)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
