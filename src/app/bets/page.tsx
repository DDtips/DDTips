"use client";

import { useState } from "react";
import { Filter, Plus, RefreshCw, Trophy, ArrowUpRight, ArrowDownRight } from "lucide-react";

// Tipi za stavo (prilagodi po potrebi)
type Bet = {
  id: string;
  date: string;
  status: "WIN" | "LOSS" | "PENDING";
  mode: "BET" | "TRADING";
  event: string;
  subEvent: string;
  back: number;
  stake: number;
  lay?: number;
  layStake?: number;
  profit: number;
  tipster: string;
  sport: string;
  bookie: string;
};

// Dummy podatki (kot na sliki)
const dummyBets: Bet[] = [
  {
    id: "1",
    date: "03.01.2026",
    status: "WIN",
    mode: "BET",
    event: "nvmbm",
    subEvent: "bvmnvbmv",
    back: 1.90,
    stake: 100,
    profit: 90,
    tipster: "DEJAN",
    sport: "NOGOMET",
    bookie: "SHARP"
  },
  {
    id: "2",
    date: "03.01.2026",
    status: "WIN",
    mode: "TRADING",
    event: "ztriuti",
    subEvent: "tuziti",
    back: 2.10,
    stake: 100,
    lay: 1.30,
    layStake: 140,
    profit: 68,
    tipster: "DAVID",
    sport: "NOGOMET",
    bookie: "SHARP"
  },
  {
    id: "3",
    date: "03.01.2026",
    status: "WIN",
    mode: "TRADING",
    event: "reet",
    subEvent: "ert",
    back: 2.80,
    stake: 100,
    lay: 2.00,
    layStake: 100,
    profit: 80,
    tipster: "DAVID",
    sport: "NOGOMET",
    bookie: "SHARP"
  },
];

export default function BetsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    // 1. POPRAVEK: pt-28 (odmik od vrha) in min-h-screen
    <main className="min-h-screen bg-[#0B1120] text-white pt-28 pb-10">
      
      {/* 2. POPRAVEK: max-w-7xl mx-auto (da je enaka širina kot header/home) */}
      <div className="max-w-7xl mx-auto px-6">
        
        {/* ZGORNJA VRSTICA (Gumbi) */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          {/* Leva stran - Logo/Naslov ali Filter */}
          <div className="flex items-center gap-2">
            <img src="/ddtips-logo.png" alt="Logo" className="h-10 w-auto" />
          </div>

          {/* Desna stran - Akcije */}
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium transition-colors">
              <Filter className="w-4 h-4" />
              <span>Filter Meseca: Januar 2026</span>
            </button>
            
            {/* 3. POPRAVEK: Gumb odpre modal */}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-green-900/20 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Nova Stava
            </button>
            
            <button className="p-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* STATISTIKA KARTICE (Profit, W/L, Odprte) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Profit */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ArrowUpRight className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Profit</p>
            <h3 className="text-3xl font-black text-green-400">238,00 €</h3>
          </div>

          {/* Card 2: W / L */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">W / L</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-green-400">3</span>
              <span className="text-xl text-slate-600">/</span>
              <span className="text-3xl font-black text-red-400">0</span>
            </div>
          </div>

          {/* Card 3: Odprte */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
            <p className="text-yellow-500/80 text-xs font-bold uppercase tracking-wider mb-1">Odprte</p>
            <h3 className="text-3xl font-black text-white">0</h3>
          </div>
        </div>

        {/* TABELA STAV */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-lg">
              <Trophy className="w-5 h-5 text-green-500" />
              Seznam Stav
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-950/50">
                <tr>
                  <th className="px-6 py-4 font-bold">Datum</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold">Mode</th>
                  <th className="px-6 py-4 font-bold">Dogodek</th>
                  <th className="px-6 py-4 font-bold text-right">Back</th>
                  <th className="px-6 py-4 font-bold text-right">Vplač.</th>
                  <th className="px-6 py-4 font-bold text-right">Lay</th>
                  <th className="px-6 py-4 font-bold text-right">Vplač.</th>
                  <th className="px-6 py-4 font-bold text-right">Profit</th>
                  <th className="px-6 py-4 font-bold text-center">Tipster / Šport</th>
                  <th className="px-6 py-4 font-bold text-right">Stavnica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {dummyBets.map((bet) => (
                  <tr key={bet.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-300">{bet.date}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                        {bet.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded text-xs font-bold border ${
                        bet.mode === "BET" 
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                          : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      }`}>
                        {bet.mode}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{bet.event}</div>
                      <div className="text-xs text-slate-500">{bet.subEvent}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300">{bet.back.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300">{bet.stake.toFixed(2)}€</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300">
                      {bet.lay ? bet.lay.toFixed(2) : "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300">
                      {bet.layStake ? `${bet.layStake.toFixed(2)}€` : "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-bold font-mono text-green-400">
                      +{bet.profit.toFixed(2)}€
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-bold text-slate-300 mb-1">
                          {bet.tipster}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400">
                          {bet.sport}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-slate-400">{bet.bookie}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL ZA NOVO STAVO (To se ni odprlo prej) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <h3 className="text-lg font-bold text-white">Nova Stava</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-slate-300 text-sm">Tukaj pridejo input polja za dodajanje stave...</p>
              {/* Primer inputa */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dogodek</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
                  placeholder="npr. Real Madrid vs Barcelona"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Prekliči
              </button>
              <button 
                onClick={() => {
                  alert("Shranjevanje...");
                  setIsModalOpen(false);
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-green-900/20"
              >
                Shrani Stavo
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}