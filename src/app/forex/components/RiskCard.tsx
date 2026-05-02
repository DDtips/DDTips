import { RiskIndicators } from "@/lib/forex/types";
import { Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface RiskCardProps {
  risk: RiskIndicators;
}

export default function RiskCard({ risk }: RiskCardProps) {
  const sentimentConfig = {
    "risk-on": {
      label: "RISK-ON",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      glow: "shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)]",
      dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
    },
    neutral: {
      label: "NEVTRALNO",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      glow: "shadow-[0_0_20px_-5px_rgba(251,191,36,0.4)]",
      dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
    },
    "risk-off": {
      label: "RISK-OFF",
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
      glow: "shadow-[0_0_20px_-5px_rgba(244,63,94,0.4)]",
      dot: "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]",
    },
  }[risk.vix.sentiment];

  const renderChangeBadge = (val: number) => {
    const isUp = val > 0;
    const isDown = val < 0;
    return (
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
            isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-zinc-400"
          }`}
        >
          {isUp ? "+" : ""}
          {val.toFixed(2)}%
        </span>
      </div>
    );
  };

  return (
    <div className="relative bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      <div className="relative p-6 md:p-8">
        {/* Header s sentiment indikatorjem */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black uppercase tracking-wider text-white">
                Risk Sentiment
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mt-0.5">
                Globalni trgi
              </p>
            </div>
          </div>

          {/* Sentiment badge */}
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${sentimentConfig.bg} ${sentimentConfig.border} ${sentimentConfig.glow}`}
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${sentimentConfig.dot}`} />
            <span className={`text-xs font-black uppercase tracking-[0.2em] ${sentimentConfig.color}`}>
              {sentimentConfig.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* VIX */}
          <div className="relative bg-black/40 rounded-2xl border border-white/5 p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                VIX
              </span>
              {renderChangeBadge(risk.vix.change)}
            </div>
            <div className="text-3xl font-mono font-black text-white tracking-tighter mb-1">
              {risk.vix.value.toFixed(2)}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
              Strah · Volatilnost
            </div>
          </div>

          {/* DXY */}
          <div className="relative bg-black/40 rounded-2xl border border-white/5 p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                DXY
              </span>
              {renderChangeBadge(risk.dxy.change)}
            </div>
            <div className="text-3xl font-mono font-black text-white tracking-tighter mb-1">
              {risk.dxy.value.toFixed(2)}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
              Dollar Index
            </div>
          </div>

          {/* SPX */}
          <div className="relative bg-black/40 rounded-2xl border border-white/5 p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                S&P 500
              </span>
              {renderChangeBadge(risk.spx.change)}
            </div>
            <div className="text-3xl font-mono font-black text-white tracking-tighter mb-1">
              {risk.spx.value.toFixed(2)}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
              Delniški trg
            </div>
          </div>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mt-5">
          ◆ VIX &lt; 18 = risk-on (AUD, NZD krepijo) · VIX &gt; 25 = risk-off (JPY, CHF, USD krepijo)
        </p>
      </div>
    </div>
  );
}
