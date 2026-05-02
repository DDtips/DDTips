import React from "react";

interface DxyData {
  value: number;
  change: number;
}

export default function DxyCard({ dxyData }: { dxyData: DxyData }) {
  const isPositive = dxyData.change >= 0;

  // Sestava DXY indeksa
  const weights = [
    { currency: "EUR", weight: 57.6, color: "bg-blue-500" },
    { currency: "JPY", weight: 13.6, color: "bg-red-500" },
    { currency: "GBP", weight: 11.9, color: "bg-purple-500" },
    { currency: "CAD", weight: 9.1, color: "bg-red-600" },
    { currency: "SEK", weight: 4.2, color: "bg-yellow-500" },
    { currency: "CHF", weight: 3.6, color: "bg-rose-600" },
  ];

  return (
    <div className="p-5 md:p-6 rounded-3xl bg-zinc-900/50 backdrop-blur-xl border border-white/5 relative overflow-hidden group">
      {/* Background glow povezan z DXY trendom */}
      <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-10 transition-colors duration-500 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`} />

      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            U.S. Dollar Index (DXY)
            <span className="group-hover:opacity-100 opacity-50 cursor-help transition-opacity text-sm" title="Meri moč ameriškega dolarja proti košarici 6 glavnih svetovnih valut.">
              ℹ️
            </span>
          </h2>
          <p className="text-sm text-zinc-400">Moč dolarja diktira forex trg</p>
        </div>

        <div className="text-right">
          <div className="text-3xl font-black text-white font-mono">
            {dxyData.value.toFixed(2)}
          </div>
          <div className={`text-sm font-bold font-mono ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
            {isPositive ? "+" : ""}{dxyData.change.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Vizualizacija sestave (Progress Bar) */}
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">
            <span>Sestava Indeksa</span>
            <span>Teža (%)</span>
          </div>
          <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden flex">
            {weights.map((w) => (
              <div 
                key={w.currency} 
                className={`${w.color} h-full border-r border-black/20 last:border-0`}
                style={{ width: `${w.weight}%` }}
                title={`${w.currency}: ${w.weight}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {weights.map((w) => (
              <div key={w.currency} className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className={`w-2 h-2 rounded-full ${w.color}`} />
                {w.currency} <span className="text-zinc-600">({w.weight}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trgovalne korelacije */}
        <div className="pt-4 border-t border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
            Obratna Korelacija (Inverse)
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-zinc-800/50 p-2 rounded-lg border border-white/5">
              <span className="text-sm font-bold text-white block">EUR/USD</span>
              <span className={`text-xs ${isPositive ? 'text-red-400' : 'text-emerald-400'}`}>
                {isPositive ? 'Pada 📉' : 'Raste 📈'}
              </span>
            </div>
            <div className="bg-zinc-800/50 p-2 rounded-lg border border-white/5">
              <span className="text-sm font-bold text-white block">GBP/USD</span>
              <span className={`text-xs ${isPositive ? 'text-red-400' : 'text-emerald-400'}`}>
                {isPositive ? 'Pada 📉' : 'Raste 📈'}
              </span>
            </div>
            <div className="bg-zinc-800/50 p-2 rounded-lg border border-white/5">
              <span className="text-sm font-bold text-white block">XAU/USD</span>
              <span className={`text-xs ${isPositive ? 'text-red-400' : 'text-emerald-400'}`}>
                {isPositive ? 'Pada 📉' : 'Raste 📈'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}