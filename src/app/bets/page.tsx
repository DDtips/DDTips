"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { Calendar, TrendingUp, DollarSign, Trophy, Users, Building2, Clock, Target, Trash2, Plus, Filter } from "lucide-react";

type WL = "OPEN" | "WIN" | "LOSS" | "VOID";
type PreLive = "PREMATCH" | "LIVE";

type BetRow = {
  id: string;
  created_at?: string;
  datum: string;
  wl: WL;
  dogodek: string;
  tip: string;
  kvota1: number;
  vplacilo1: number;
  lay_kvota: number | null;
  vplacilo2: number | null;
  komisija: number | null;
  sport: string;
  cas_stave: PreLive;
  tipster: string;
  stavnica: string;
};

const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"] as const;
const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"] as const;
const STAVNICE = ["SHARP", "PINNACLE", "BET365", "WINAMAX", "WWIN", "E-STAVE", "BET AT HOME"] as const;
const PRELIVE: PreLive[] = ["PREMATCH", "LIVE"];

function eur(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}${v.toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function parseNum(x: string) {
  const s = (x ?? "").toString().trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function calcProfit(b: BetRow) {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;

  const stake = Number(b.vplacilo1 || 0);
  const odds = Number(b.kvota1 || 0);
  const hasLay = (b.lay_kvota ?? 0) > 0 && (b.vplacilo2 ?? 0) > 0;
  const layOdds = Number(b.lay_kvota || 0);
  const layStake = Number(b.vplacilo2 || 0);
  const layLiability = hasLay ? (layOdds - 1) * layStake : 0;
  const kom = Number(b.komisija ?? 0);

  if (b.wl === "WIN") {
    const backProfit = (odds - 1) * stake;
    return backProfit - layLiability - kom;
  }

  const base = -stake + (hasLay ? layStake : 0);
  return base - kom;
}

// Helper: dobi trenutni mesec v formatu YYYY-MM
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function BetsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Filter za mesec
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [wl, setWl] = useState<WL>("OPEN");
  const [sport, setSport] = useState<(typeof SPORTI)[number]>("NOGOMET");
  const [casStave, setCasStave] = useState<PreLive>("PREMATCH");
  const [dogodek, setDogodek] = useState("");
  const [tip, setTip] = useState("");
  const [kvota1, setKvota1] = useState("2.00");
  const [vplacilo1, setVplacilo1] = useState("100");
  const [layKvota, setLayKvota] = useState("");
  const [vplacilo2, setVplacilo2] = useState("");
  const [komisija, setKomisija] = useState("0");
  const [tipster, setTipster] = useState<(typeof TIPSTERJI)[number]>("DAVID");
  const [stavnica, setStavnica] = useState<(typeof STAVNICE)[number]>("SHARP");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editWl, setEditWl] = useState<WL>("OPEN");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        window.location.href = "/login";
        return;
      }
      setUser(data.user);
      await loadBets();
    })();
  }, []);

  async function loadBets() {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase
      .from("bets")
      .select("*")
      .order("datum", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    setRows((data || []) as BetRow[]);
    setLoading(false);
  }

  async function addBet() {
    setMsg(null);

    if (!dogodek.trim() || !tip.trim()) {
      setMsg("Manjka dogodek ali tip.");
      return;
    }

    const payload = {
      datum,
      wl,
      dogodek: dogodek.trim(),
      tip: tip.trim(),
      kvota1: parseNum(kvota1),
      vplacilo1: parseNum(vplacilo1),
      lay_kvota: layKvota.trim() !== "" ? parseNum(layKvota) : 0,
      vplacilo2: vplacilo2.trim() !== "" ? parseNum(vplacilo2) : 0,
      komisija: komisija.trim() !== "" ? parseNum(komisija) : 0,
      sport,
      cas_stave: casStave,
      tipster,
      stavnica,
      created_by: user?.id || null,
    };

    const { data, error } = await supabase
      .from("bets")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      setMsg(error.message);
      return;
    }

    setRows((prev) => [data as BetRow, ...prev]);
    setWl("OPEN");
    setDogodek("");
    setTip("");
  }

  async function deleteBet(id: string) {
    const ok = confirm("Si prepričan, da želiš izbrisati to stavo?");
    if (!ok) return;

    setMsg(null);

    const { error } = await supabase.from("bets").delete().eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== id));
    await loadBets();
  }

  function openEdit(b: BetRow) {
    setEditId(b.id);
    setEditWl(b.wl);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editId) return;
    setMsg(null);

    const { error } = await supabase.from("bets").update({ wl: editWl }).eq("id", editId);

    if (error) {
      setMsg(error.message);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === editId ? { ...r, wl: editWl } : r)));
    setEditOpen(false);
    setEditId(null);
  }

  // Filtrirane stave po mesecu
  const filteredRows = useMemo(() => {
    return rows.filter(r => r.datum.startsWith(selectedMonth));
  }, [rows, selectedMonth]);

  const computed = useMemo(() => {
    const withProfit = filteredRows.map((r) => ({ ...r, profit: calcProfit(r) }));
    return { withProfit };
  }, [filteredRows]);

  // Pridobi unikalne mesece iz vseh stav
  const availableMonths = useMemo(() => {
    const months = new Set(rows.map(r => r.datum.slice(0, 7)));
    return Array.from(months).sort().reverse(); // Najnovejši prvi
  }, [rows]);

  const getWlColor = (wl: WL) => {
    if (wl === "WIN") return "from-green-500 to-emerald-500";
    if (wl === "LOSS") return "from-red-500 to-rose-500";
    if (wl === "VOID") return "from-gray-500 to-slate-500";
    return "from-yellow-500 to-amber-500";
  };

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{animationDelay: "1s"}}></div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-black text-white mb-2">Stave</h1>
            <div className="text-green-400 font-semibold">
              Prijavljen kot: {user?.email || "-"}
            </div>
          </div>
        </div>

        {msg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200">
            {msg}
          </div>
        )}

        {/* Add Bet Form */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-yellow-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-green-500 to-yellow-500 p-3 rounded-xl">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white">Dodaj stavo</h2>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Datum
                </label>
                <input
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-green-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Trophy className="w-4 h-4 inline mr-1" />
                  W/L
                </label>
                <select
                  value={wl}
                  onChange={(e) => setWl(e.target.value as WL)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-green-400 transition-all"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="WIN">WIN</option>
                  <option value="LOSS">LOSS</option>
                  <option value="VOID">VOID</option>
                </select>
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Target className="w-4 h-4 inline mr-1" />
                  Šport
                </label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value as any)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-green-400 transition-all"
                >
                  {SPORTI.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Prematch/Live
                </label>
                <select
                  value={casStave}
                  onChange={(e) => setCasStave(e.target.value as PreLive)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-green-400 transition-all"
                >
                  {PRELIVE.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-white/80 text-sm font-semibold mb-2">Dogodek</label>
                <input
                  value={dogodek}
                  onChange={(e) => setDogodek(e.target.value)}
                  placeholder="npr. Dinamo : Hajduk"
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-green-400 transition-all"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-white/80 text-sm font-semibold mb-2">Tip</label>
                <input
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  placeholder="npr. Dinamo to win"
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-green-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">Kvota 1</label>
                <input
                  value={kvota1}
                  onChange={(e) => setKvota1(e.target.value)}
                  placeholder="2.00"
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-green-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Vplačilo 1
                </label>
                <input
                  value={vplacilo1}
                  onChange={(e) => setVplacilo1(e.target.value)}
                  placeholder="100"
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-green-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">Lay kvota</label>
                <input
                  value={layKvota}
                  onChange={(e) => setLayKvota(e.target.value)}
                  placeholder="1.10"
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-green-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">Vplačilo 2</label>
                <input
                  value={vplacilo2}
                  onChange={(e) => setVplacilo2(e.target.value)}
                  placeholder="100"
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-green-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">Komisija</label>
                <input
                  value={komisija}
                  onChange={(e) => setKomisija(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-green-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Tipster
                </label>
                <select
                  value={tipster}
                  onChange={(e) => setTipster(e.target.value as any)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-green-400 transition-all"
                >
                  {TIPSTERJI.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/80 text-sm font-semibold mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Stavnica
                </label>
                <select
                  value={stavnica}
                  onChange={(e) => setStavnica(e.target.value as any)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-green-400 transition-all"
                >
                  {STAVNICE.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-3">
                <button
                  onClick={addBet}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-yellow-500 text-white font-bold rounded-xl hover:from-green-500 hover:to-yellow-400 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Dodaj
                </button>
                <button
                  onClick={loadBets}
                  className="px-6 py-3 bg-white/10 border-2 border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-all"
                >
                  Osveži
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Month Filter */}
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur-lg"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-lg flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-2 rounded-lg">
                <Filter className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold">Filter po mesecu:</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 bg-white/10 border-2 border-white/20 rounded-xl text-white font-semibold focus:outline-none focus:border-blue-400 transition-all"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {new Date(month + '-01').toLocaleDateString('sl-SI', { year: 'numeric', month: 'long' })}
                </option>
              ))}
            </select>
            <div className="text-white/60 ml-auto">
              Prikazujem: <span className="text-white font-bold">{computed.withProfit.length}</span> stav
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-green-600/10 to-yellow-600/10 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-white">Vse stave</h2>
              <div className="text-white/60">{computed.withProfit.length} vrstic</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-white/80 font-bold text-sm">Datum</th>
                    <th className="text-left py-4 px-4 text-white/80 font-bold text-sm">Status</th>
                    <th className="text-left py-4 px-4 text-white/80 font-bold text-sm">Dogodek</th>
                    <th className="text-left py-4 px-4 text-white/80 font-bold text-sm">Tip</th>
                    <th className="text-left py-4 px-4 text-white/80 font-bold text-sm">Kvota</th>
                    <th className="text-left py-4 px-4 text-white/80 font-bold text-sm">Vplačilo</th>
                    <th className="text-left py-4 px-4 text-white/80 font-bold text-sm">Dobiček</th>
                    <th className="text-left py-4 px-4 text-white/80 font-bold text-sm">Šport</th>
                    <th className="text-left py-4 px-4 text-white/80 font-bold text-sm">Tipster</th>
                    <th className="text-left py-4 px-4 text-white/80 font-bold text-sm">Stavnica</th>
                    <th className="text-right py-4 px-4 text-white/80 font-bold text-sm">Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {computed.withProfit.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 text-white/90 text-sm">{r.datum}</td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => openEdit(r)}
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${getWlColor(r.wl)} hover:scale-105 transition-transform cursor-pointer`}
                        >
                          {r.wl}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-white/90 text-sm">{r.dogodek}</td>
                      <td className="py-4 px-4 text-white/70 text-sm">{r.tip}</td>
                      <td className="py-4 px-4 text-white/90 font-semibold text-sm">{r.kvota1}</td>
                      <td className="py-4 px-4 text-white/90 text-sm">{eur(r.vplacilo1)}</td>
                      <td className={`py-4 px-4 font-bold text-sm ${(r as any).profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {eur((r as any).profit)}
                      </td>
                      <td className="py-4 px-4 text-white/70 text-sm">{r.sport}</td>
                      <td className="py-4 px-4 text-white/90 text-sm">{r.tipster}</td>
                      <td className="py-4 px-4 text-white/90 text-sm">{r.stavnica}</td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => deleteBet(r.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!computed.withProfit.length && (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-white/50">
                        Ni stav za izbrani mesec.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div
          onClick={() => setEditOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-2xl font-bold text-white mb-4">Zapri stavo</h3>
            
            <div className="mb-6">
              <label className="block text-white/80 text-sm font-semibold mb-2">Rezultat</label>
              <select
                value={editWl}
                onChange={(e) => setEditWl(e.target.value as WL)}
                className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-green-400 transition-all"
              >
                <option value="OPEN">OPEN</option>
                <option value="WIN">WIN</option>
                <option value="LOSS">LOSS</option>
                <option value="VOID">VOID</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 px-6 py-3 bg-white/10 border-2 border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-all"
              >
                Prekliči
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-yellow-500 text-white font-bold rounded-xl hover:from-green-500 hover:to-yellow-400 transition-all shadow-lg"
              >
                Shrani
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}