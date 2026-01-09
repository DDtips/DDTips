"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  Calendar,
  TrendingUp,
  DollarSign,
  Trophy,
  Users,
  Building2,
  Clock,
  Target,
  Trash2,
  Plus,
  Filter,
  Activity,
  X,
  Check,
  Percent,
  Pencil,
  ChevronDown,
  Save,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

// --- TIPOVI ---

type WL = "OPEN" | "WIN" | "LOSS" | "VOID" | "BACK WIN" | "LAY WIN";
type PreLive = "PREMATCH" | "LIVE";
type Mode = "BET" | "TRADING";
type BetSide = "BACK" | "LAY";

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
  vplacilo2: number | null; // To obravnavamo kot LIABILITY
  komisija: number | null;
  sport: string;
  cas_stave: PreLive;
  tipster: string;
  stavnica: string;
  mode?: Mode | null;
};

const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "DABSTER", "BALKAN"] as const;
const SPORTI = ["NOGOMET", "TENIS", "KOŠARKA", "SM. SKOKI", "SMUČANJE", "BIATLON", "OSTALO"] as const;
const STAVNICE = ["SHARP", "PINNACLE", "BET365", "WINAMAX", "WWIN", "E-STAVE", "BET AT HOME"] as const;
const PRELIVE: PreLive[] = ["PREMATCH", "LIVE"];
const MODES: Mode[] = ["BET", "TRADING"];
const BET_SIDES: BetSide[] = ["BACK", "LAY"];

// --- POMOŽNE FUNKCIJE ---

function eur(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}${v.toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function eurCompact(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}${v.toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
}

function parseNum(x: string | number) {
  if (typeof x === "number") return x;
  const s = (x ?? "").toString().trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatDateSlovenian(dateStr: string) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

function hasBack(b: BetRow): boolean {
  return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0;
}

function hasLay(b: BetRow): boolean {
  return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0;
}

function calcProfit(b: BetRow): number {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;

  const komPct = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0;
  const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0; // Vplačilo pri LAY je Liability
  const layOdds = b.lay_kvota || 0;
  
  // Lay Stake = Koliko dobimo, če stava na exchange-u ne gre skozi
  const layStake = (layOdds > 1) ? layLiability / (layOdds - 1) : 0;

  const applyCommission = (profit: number) => {
    return profit > 0 ? profit * (1 - komPct / 100) : profit;
  };

  // Case 1: Samo BACK stava
  if (hasBack(b) && !hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") return applyCommission(backStake * (backOdds - 1));
    if (b.wl === "LOSS" || b.wl === "LAY WIN") return -backStake;
  }

  // Case 2: Samo LAY stava
  if (!hasBack(b) && hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") return applyCommission(layStake);
    if (b.wl === "LOSS" || b.wl === "BACK WIN") return -layLiability;
  }

  // Case 3: TRADING (Oba vpisana)
  if (hasBack(b) && hasLay(b)) {
    const profitIfBackWins = (backStake * (backOdds - 1)) - layLiability;
    const profitIfLayWins = layStake - backStake;

    if (b.wl === "BACK WIN" || b.wl === "WIN") return applyCommission(profitIfBackWins);
    if (b.wl === "LAY WIN" || b.wl === "LOSS") return applyCommission(profitIfLayWins);
  }

  return 0;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// --- KOMPONENTE UI ---

function MonthSelect({ value, onChange, options }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const getLabel = (m: string) => new Date(m + "-01").toLocaleDateString("sl-SI", { year: "numeric", month: "long" });
  return (
    <div className="relative w-full">
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${isOpen ? "bg-zinc-900 border-emerald-500/50 text-white" : "bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:bg-zinc-900"}`}>
        <span>{getLabel(value)}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && <><div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-1 max-h-[240px] overflow-y-auto custom-scrollbar">
        {options.map((month: string) => (
          <button key={month} onClick={() => { onChange(month); setIsOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium border-l-2 ${month === value ? "bg-emerald-500/10 text-emerald-400 border-emerald-500" : "text-zinc-400 hover:bg-zinc-900 border-transparent"}`}>{getLabel(month)}</button>
        ))}
      </div></>}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text", icon, inputMode, pattern }: any) {
  return (
    <div className="space-y-1.5 group">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon}{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} pattern={pattern} className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, icon }: any) {
  return (
    <div className="space-y-1.5 group">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon}{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm appearance-none focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer pr-8">
          {options.map((opt: string) => <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
      </div>
    </div>
  );
}

function StatusBadge({ wl, onClick }: { wl: WL; onClick?: () => void }) {
  const styles = { 
    WIN: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", 
    LOSS: "bg-rose-500/10 text-rose-400 border-rose-500/30", 
    VOID: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30", 
    OPEN: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    "BACK WIN": "bg-emerald-600/20 text-emerald-400 border-emerald-600/50 shadow-[0_0_10px_-2px_rgba(16,185,129,0.2)]",
    "LAY WIN": "bg-pink-600/20 text-pink-400 border-pink-600/50 shadow-[0_0_10px_-2px_rgba(219,39,119,0.2)]"
  } as const;
  return <button onClick={onClick} className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${styles[wl] || styles.OPEN} transition-all hover:brightness-125 cursor-pointer uppercase`}>{wl}</button>;
}

// --- GLAVNA STRAN ---

export default function BetsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  // Form states
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [wl, setWl] = useState<WL>("OPEN");
  const [sport, setSport] = useState<(typeof SPORTI)[number]>("NOGOMET");
  const [casStave, setCasStave] = useState<PreLive>("PREMATCH");
  const [dogodek, setDogodek] = useState("");
  const [tip, setTip] = useState("");
  const [mode, setMode] = useState<Mode>("BET");
  const [betSide, setBetSide] = useState<BetSide>("BACK");
  const [kvota1, setKvota1] = useState("");
  const [vplacilo1, setVplacilo1] = useState("");
  const [layKvota, setLayKvota] = useState("");
  const [vplacilo2, setVplacilo2] = useState(""); // Liability
  const [komisija, setKomisija] = useState("0");
  const [tipster, setTipster] = useState<(typeof TIPSTERJI)[number]>("DAVID");
  const [stavnica, setStavnica] = useState<(typeof STAVNICE)[number]>("SHARP");

  // Modals
  const [statusEditOpen, setStatusEditOpen] = useState(false);
  const [statusEditId, setStatusEditId] = useState<string | null>(null);
  const [statusEditWl, setStatusEditWl] = useState<WL>("OPEN");

  const [fullEditOpen, setFullEditOpen] = useState(false);
  const [editingBet, setEditingBet] = useState<BetRow | null>(null);
  const [editKvota1, setEditKvota1] = useState("");
  const [editVplacilo1, setEditVplacilo1] = useState("");
  const [editLayKvota, setEditLayKvota] = useState("");
  const [editVplacilo2, setEditVplacilo2] = useState("");
  const [editKomisija, setEditKomisija] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) { window.location.href = "/login"; return; }
      setUser(data.user);
      await loadBets();
    })();
  }, []);

  async function loadBets() {
    setLoading(true);
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: false }).order("created_at", { ascending: false });
    if (!error) setRows((data || []) as BetRow[]);
    setLoading(false);
  }

  function resetForm() {
    setWl("OPEN"); setDogodek(""); setTip(""); setMode("BET"); setBetSide("BACK"); setKvota1(""); setVplacilo1(""); setLayKvota(""); setVplacilo2(""); setKomisija("0");
  }

  async function addBet() {
    setMsg(null);
    if (!dogodek.trim() || !tip.trim()) { setMsg("Manjka dogodek ali tip."); return; }
    
    const bQ = parseNum(kvota1); const bS = parseNum(vplacilo1);
    const lQ = parseNum(layKvota); const lS = parseNum(vplacilo2);

    const payload: any = { datum, wl, dogodek: dogodek.trim(), tip: tip.trim(), komisija: parseNum(komisija), sport, cas_stave: casStave, tipster, stavnica, created_by: user?.id, mode };
    
    if (mode === "TRADING") { payload.kvota1 = bQ; payload.vplacilo1 = bS; payload.lay_kvota = lQ; payload.vplacilo2 = lS; }
    else {
      if (betSide === "BACK") { payload.kvota1 = bQ; payload.vplacilo1 = bS; payload.lay_kvota = 0; payload.vplacilo2 = 0; }
      else { payload.kvota1 = 0; payload.vplacilo1 = 0; payload.lay_kvota = lQ; payload.vplacilo2 = lS; }
    }

    const { data, error } = await supabase.from("bets").insert(payload).select("*").single();
    if (error) { setMsg(error.message); return; }
    setRows((prev) => [data as BetRow, ...prev]);
    resetForm();
  }

  async function saveStatusEdit() {
    if (!statusEditId) return;
    const { error } = await supabase.from("bets").update({ wl: statusEditWl }).eq("id", statusEditId);
    if (error) return;
    setRows((prev) => prev.map((r) => (r.id === statusEditId ? { ...r, wl: statusEditWl } : r)));
    setStatusEditOpen(false);
  }

  async function saveFullEdit() {
    if (!editingBet) return;
    const updated = { ...editingBet, kvota1: parseNum(editKvota1), vplacilo1: parseNum(editVplacilo1), lay_kvota: parseNum(editLayKvota), vplacilo2: parseNum(editVplacilo2), komisija: parseNum(editKomisija) };
    const { error } = await supabase.from("bets").update(updated).eq("id", updated.id);
    if (error) { alert(error.message); return; }
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setFullEditOpen(false);
  }

  const filteredRows = useMemo(() => rows.filter((r) => r.datum.startsWith(selectedMonth)), [rows, selectedMonth]);
  const computedRows = useMemo(() => filteredRows.map(r => ({ ...r, profit: calcProfit(r) })), [filteredRows]);
  
  const stats = useMemo(() => {
    const settled = computedRows.filter(r => r.wl !== "OPEN" && r.wl !== "VOID");
    return {
      profit: settled.reduce((acc, r) => acc + r.profit, 0),
      wins: settled.filter(r => r.wl === "WIN" || r.wl === "BACK WIN" || r.wl === "LAY WIN").length,
      losses: settled.filter(r => r.wl === "LOSS").length,
      open: computedRows.filter(r => r.wl === "OPEN").length
    };
  }, [computedRows]);

  const availableMonths = useMemo(() => Array.from(new Set(rows.map(r => r.datum.slice(0, 7)))).sort().reverse(), [rows]);

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto pt-20">
        
        {/* ADD FORM */}
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
             <Plus className="w-5 h-5 text-emerald-500" />
             <h2 className="text-sm font-bold uppercase tracking-widest">Nova Stava</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <InputField label="Datum" value={datum} onChange={setDatum} type="date" icon={<Calendar className="w-3 h-3" />} />
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Status</label>
               <div className="grid grid-cols-2 gap-1">
                  <button onClick={() => setWl("BACK WIN")} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${wl === "BACK WIN" ? "bg-emerald-500 text-black border-emerald-400" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900"}`}>BACK WIN</button>
                  <button onClick={() => setWl("LAY WIN")} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${wl === "LAY WIN" ? "bg-pink-500 text-black border-pink-400" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900"}`}>LAY WIN</button>
               </div>
            </div>
            <SelectField label="Šport" value={sport} onChange={setSport} options={SPORTI} icon={<Target className="w-3 h-3" />} />
            <SelectField label="Čas" value={casStave} onChange={setCasStave} options={PRELIVE} icon={<Clock className="w-3 h-3" />} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <InputField label="Dogodek" value={dogodek} onChange={setDogodek} placeholder="Home vs Away" />
            <InputField label="Tip" value={tip} onChange={setTip} placeholder="npr. Over 2.5" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 items-end">
            <SelectField label="Vnos" value={mode} onChange={setMode} options={MODES} icon={<Activity className="w-3 h-3" />} />
            {mode === "BET" && <SelectField label="Stran" value={betSide} onChange={setBetSide} options={BET_SIDES} />}
            <InputField label="Komisija (%)" value={komisija} onChange={setKomisija} icon={<Percent className="w-3 h-3" />} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 rounded-xl bg-zinc-950/50 border border-zinc-800">
            {(mode === "TRADING" || betSide === "BACK") && (
              <>
                <InputField label="Back Kvota" value={kvota1} onChange={setKvota1} icon={<TrendingUp className="w-3 h-3 text-emerald-500" />} />
                <InputField label="Back Vložek" value={vplacilo1} onChange={setVplacilo1} icon={<DollarSign className="w-3 h-3 text-emerald-500" />} />
              </>
            )}
            {(mode === "TRADING" || betSide === "LAY") && (
              <>
                <InputField label="Lay Kvota" value={layKvota} onChange={setLayKvota} icon={<TrendingUp className="w-3 h-3 text-pink-500" />} />
                <InputField label="Lay Liability" value={vplacilo2} onChange={setVplacilo2} icon={<DollarSign className="w-3 h-3 text-pink-500" />} />
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-4 items-end justify-between">
            <div className="flex gap-4">
              <SelectField label="Tipster" value={tipster} onChange={setTipster} options={TIPSTERJI} />
              <SelectField label="Stavnica" value={stavnica} onChange={setStavnica} options={STAVNICE} />
            </div>
            <button onClick={addBet} className="px-8 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20">
              <Plus className="w-5 h-5" /> Dodaj Stavo
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="col-span-2 md:col-span-1">
             <MonthSelect value={selectedMonth} onChange={setSelectedMonth} options={availableMonths} />
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Mesečni Profit</p>
            <p className={`text-2xl font-bold ${stats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eur(stats.profit)}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
            <p className="text-[10px] font-bold text-zinc-500 uppercase">W / L</p>
            <p className="text-2xl font-bold"><span className="text-emerald-400">{stats.wins}</span> / <span className="text-rose-400">{stats.losses}</span></p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
            <p className="text-[10px] font-bold text-zinc-500 uppercase">Odprte</p>
            <p className="text-2xl font-bold text-amber-400">{stats.open}</p>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/80 border-b border-zinc-800">
                <tr>
                  <th className="p-4 text-left font-bold text-zinc-500 uppercase text-[10px]">Datum</th>
                  <th className="p-4 text-center font-bold text-zinc-500 uppercase text-[10px]">Status</th>
                  <th className="p-4 text-left font-bold text-zinc-500 uppercase text-[10px]">Dogodek / Tip</th>
                  <th className="p-4 text-center font-bold text-zinc-500 uppercase text-[10px]">Back (Q/S)</th>
                  <th className="p-4 text-center font-bold text-zinc-500 uppercase text-[10px]">Lay (Q/L)</th>
                  <th className="p-4 text-center font-bold text-zinc-500 uppercase text-[10px]">Profit</th>
                  <th className="p-4 text-center font-bold text-zinc-500 uppercase text-[10px]">Akcije</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {computedRows.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 text-zinc-400">{formatDateSlovenian(r.datum)}</td>
                    <td className="p-4 text-center"><StatusBadge wl={r.wl} onClick={() => { setStatusEditId(r.id); setStatusEditWl(r.wl); setStatusEditOpen(true); }} /></td>
                    <td className="p-4">
                      <p className="font-bold text-zinc-200">{r.dogodek}</p>
                      <p className="text-xs text-zinc-500">{r.tip}</p>
                    </td>
                    <td className="p-4 text-center">
                      {r.kvota1 > 0 ? (
                        <div className="flex flex-col">
                          <span className="text-emerald-400 font-bold">{r.kvota1.toFixed(2)}</span>
                          <span className="text-[10px] text-zinc-500">{eurCompact(r.vplacilo1)}</span>
                        </div>
                      ) : "-"}
                    </td>
                    <td className="p-4 text-center">
                      {r.lay_kvota && r.lay_kvota > 0 ? (
                        <div className="flex flex-col">
                          <span className="text-pink-400 font-bold">{r.lay_kvota.toFixed(2)}</span>
                          <span className="text-[10px] text-zinc-500">Liab: {eurCompact(r.vplacilo2 || 0)}</span>
                        </div>
                      ) : "-"}
                    </td>
                    <td className={`p-4 text-center font-mono font-bold text-lg ${r.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {eurCompact(r.profit)}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingBet(r); setEditKvota1(r.kvota1.toString()); setEditVplacilo1(r.vplacilo1.toString()); setEditLayKvota(r.lay_kvota?.toString() || ""); setEditVplacilo2(r.vplacilo2?.toString() || ""); setEditKomisija(r.komisija?.toString() || "0"); setFullEditOpen(true); }} className="p-2 bg-zinc-800 rounded-lg hover:text-emerald-400"><Pencil className="w-4 h-4" /></button>
                        <button onClick={async () => { if(confirm("Izbrišem?")) { await supabase.from("bets").delete().eq("id", r.id); loadBets(); } }} className="p-2 bg-zinc-800 rounded-lg hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* STATUS MODAL */}
      {statusEditOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4" onClick={() => setStatusEditOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6 text-center">Rezultat</h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button onClick={() => setStatusEditWl("BACK WIN")} className={`p-4 rounded-2xl border-2 font-bold flex flex-col items-center gap-2 transition-all ${statusEditWl === "BACK WIN" ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-zinc-800 text-zinc-500"}`}>
                <ArrowUpRight /> BACK WIN
              </button>
              <button onClick={() => setStatusEditWl("LAY WIN")} className={`p-4 rounded-2xl border-2 font-bold flex flex-col items-center gap-2 transition-all ${statusEditWl === "LAY WIN" ? "border-pink-500 bg-pink-500/20 text-pink-400" : "border-zinc-800 text-zinc-500"}`}>
                <ArrowDownRight /> LAY WIN
              </button>
              <button onClick={() => setStatusEditWl("VOID")} className={`p-3 rounded-xl border border-zinc-800 font-bold ${statusEditWl === "VOID" ? "bg-zinc-700" : ""}`}>VOID</button>
              <button onClick={() => setStatusEditWl("OPEN")} className={`p-3 rounded-xl border border-zinc-800 font-bold ${statusEditWl === "OPEN" ? "bg-amber-600" : ""}`}>OPEN</button>
            </div>
            <div className="flex gap-3">
              <button onClick={saveStatusEdit} className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all">Potrdi</button>
            </div>
          </div>
        </div>
      )}

      {/* FULL EDIT MODAL */}
      {fullEditOpen && editingBet && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4" onClick={() => setFullEditOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Uredi stavo</h3>
              <button onClick={() => setFullEditOpen(false)}><X /></button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Kvota 1 (Back)" value={editKvota1} onChange={setEditKvota1} />
                <InputField label="Vplačilo 1 (Back)" value={editVplacilo1} onChange={setEditVplacilo1} />
                <InputField label="Kvota 2 (Lay)" value={editLayKvota} onChange={setEditLayKvota} />
                <InputField label="Liability (Lay)" value={editVplacilo2} onChange={setEditVplacilo2} />
              </div>
              <InputField label="Komisija %" value={editKomisija} onChange={setEditKomisija} />
              <button onClick={saveFullEdit} className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl flex items-center justify-center gap-2"><Save /> Shrani spremembe</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}