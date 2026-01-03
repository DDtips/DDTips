"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Trash2, Calendar, Search, Filter, ArrowRightLeft, Target, Wallet } from "lucide-react";

// Types
type WL = "OPEN" | "WIN" | "LOSS" | "VOID";
type Mode = "BET" | "TRADING";
type BetRow = { id: string; datum: string; wl: WL; dogodek: string; tip: string; kvota1: number; vplacilo1: number; lay_kvota: number; vplacilo2: number; komisija: number; sport: string; cas_stave: string; tipster: string; stavnica: string; mode?: Mode; };

const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"];
const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"];
const STAVNICE = ["SHARP", "PINNACLE", "BET365", "WINAMAX", "WWIN", "E-STAVE", "BET AT HOME"];

// Helpers
function eur(n: number) { return Math.abs(n).toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
function parseNum(x: string) { const n = parseFloat(x.replace(",", ".")); return isNaN(n) ? 0 : n; }
function calcProfit(b: BetRow): number {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;
  const backStake = b.vplacilo1 || 0; const backOdds = b.kvota1 || 0;
  const layStake = b.vplacilo2 || 0; const layOdds = b.lay_kvota || 0;
  const liab = (layOdds - 1) * layStake; const kom = b.komisija || 0;
  const hasB = backStake > 0; const hasL = layStake > 0;

  if (hasB && hasL) return b.wl === "WIN" ? (backStake * (backOdds - 1)) - liab - kom : -backStake + layStake - kom;
  if (hasL) return b.wl === "WIN" ? layStake - kom : -liab - kom;
  return b.wl === "WIN" ? backStake * (backOdds - 1) - kom : -backStake - kom;
}

// UI Components
const Input = ({ label, ...props }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">{label}</label>
    <input {...props} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none" />
  </div>
);
const Select = ({ label, options, ...props }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">{label}</label>
    <select {...props} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer">
      {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

export default function BetsPage() {
  const [rows, setRows] = useState<BetRow[]>([]);
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [dogodek, setDogodek] = useState("");
  const [tip, setTip] = useState("");
  const [kvota1, setKvota1] = useState("");
  const [vplacilo1, setVplacilo1] = useState("");
  const [layKvota, setLayKvota] = useState("");
  const [vplacilo2, setVplacilo2] = useState("");
  const [wl, setWl] = useState<WL>("OPEN");
  const [sport, setSport] = useState(SPORTI[0]);
  const [tipster, setTipster] = useState(TIPSTERJI[0]);
  const [stavnica, setStavnica] = useState(STAVNICE[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadBets(); }, []);

  async function loadBets() {
    setLoading(true);
    const { data } = await supabase.from("bets").select("*").order("datum", { ascending: false }).order("created_at", { ascending: false });
    setRows((data || []) as BetRow[]);
    setLoading(false);
  }

  async function addBet() {
    if (!dogodek || !tip) return alert("Manjka dogodek ali tip!");
    const payload = {
      datum, wl, dogodek, tip, sport, tipster, stavnica, cas_stave: "PREMATCH",
      kvota1: parseNum(kvota1), vplacilo1: parseNum(vplacilo1),
      lay_kvota: parseNum(layKvota), vplacilo2: parseNum(vplacilo2), komisija: 0
    };
    await supabase.from("bets").insert(payload);
    loadBets();
    setDogodek(""); setTip(""); setKvota1(""); setVplacilo1(""); setLayKvota(""); setVplacilo2("");
  }

  async function deleteBet(id: string) {
    if (confirm("Izbrišem stavo?")) {
      await supabase.from("bets").delete().eq("id", id);
      setRows(r => r.filter(x => x.id !== id));
    }
  }

  return (
    <main className="min-h-screen pt-24 pb-12 px-4 md:px-8 bg-black">
      <div className="max-w-[1800px] mx-auto space-y-8">
        {/* Input Card */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-6 border-b border-zinc-800/50 pb-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><Plus className="w-5 h-5"/></div>
            <h2 className="font-bold text-white">Nova Stava</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <Input label="Datum" type="date" value={datum} onChange={(e:any) => setDatum(e.target.value)} />
            <Select label="Status" options={["OPEN", "WIN", "LOSS", "VOID"]} value={wl} onChange={(e:any) => setWl(e.target.value)} />
            <Select label="Šport" options={SPORTI} value={sport} onChange={(e:any) => setSport(e.target.value)} />
            <Select label="Tipster" options={TIPSTERJI} value={tipster} onChange={(e:any) => setTipster(e.target.value)} />
            <Select label="Stavnica" options={STAVNICE} value={stavnica} onChange={(e:any) => setStavnica(e.target.value)} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Input label="Dogodek" placeholder="Real Madrid vs Barcelona" value={dogodek} onChange={(e:any) => setDogodek(e.target.value)} />
            <Input label="Tip" placeholder="Over 2.5 Goals" value={tip} onChange={(e:any) => setTip(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-zinc-950/30 rounded-2xl border border-zinc-800/30">
            <Input label="Back Kvota" placeholder="2.00" value={kvota1} onChange={(e:any) => setKvota1(e.target.value)} />
            <Input label="Back Vplačilo" placeholder="100" value={vplacilo1} onChange={(e:any) => setVplacilo1(e.target.value)} />
            <Input label="Lay Kvota" placeholder="-" value={layKvota} onChange={(e:any) => setLayKvota(e.target.value)} />
            <Input label="Lay Vplačilo" placeholder="-" value={vplacilo2} onChange={(e:any) => setVplacilo2(e.target.value)} />
          </div>

          <button onClick={addBet} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)]">
            Dodaj Stavo
          </button>
        </div>

        {/* Table */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-950/50 text-zinc-500 uppercase font-bold tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="p-4">Datum</th>
                  <th className="p-4">Dogodek</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Back</th>
                  <th className="p-4 text-center">Lay</th>
                  <th className="p-4 text-center">Profit</th>
                  <th className="p-4 text-center">Info</th>
                  <th className="p-4 text-center">Akcija</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {rows.map((r) => {
                  const profit = calcProfit(r);
                  return (
                    <tr key={r.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="p-4 font-mono text-zinc-400">{r.datum.slice(5)}</td>
                      <td className="p-4">
                        <div className="font-bold text-white text-sm mb-0.5">{r.dogodek}</div>
                        <div className="text-zinc-500">{r.tip}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-md font-bold text-[10px] border ${
                          r.wl === 'WIN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          r.wl === 'LOSS' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>{r.wl}</span>
                      </td>
                      <td className="p-4 text-center">
                        {r.vplacilo1 > 0 && (
                          <div className="flex flex-col">
                            <span className="text-sky-400 font-bold">{r.kvota1.toFixed(2)}</span>
                            <span className="text-zinc-500">{eur(r.vplacilo1)}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {r.vplacilo2 > 0 && (
                          <div className="flex flex-col">
                            <span className="text-rose-400 font-bold">{(r.lay_kvota || 0).toFixed(2)}</span>
                            <span className="text-zinc-500">{eur(r.vplacilo2 || 0)}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-sm font-bold font-mono ${profit > 0 ? 'text-emerald-400' : profit < 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
                          {profit > 0 ? "+" : ""}{eur(profit)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">{r.sport}</span>
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">{r.stavnica}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => deleteBet(r.id)} className="p-2 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg text-zinc-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}