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
  RefreshCw,
  Activity,
  X,
  Check,
  Percent,
  Pencil,
  ChevronDown 
} from "lucide-react";

// --- TIPOVI ---

type WL = "OPEN" | "WIN" | "LOSS" | "VOID";
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
  vplacilo2: number | null;
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

function parseNum(x: string) {
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

  const kom = Number(b.komisija ?? 0);
  const hasBackBet = hasBack(b);
  const hasLayBet = hasLay(b);

  const backStake = b.vplacilo1 || 0;
  const backOdds = b.kvota1 || 0;
  const layStake = b.vplacilo2 || 0;
  const layOdds = b.lay_kvota || 0;
  const layLiability = (layOdds - 1) * layStake;

  if (!hasBackBet && hasLayBet) {
    if (b.wl === "WIN") return layStake - kom;
    return -layLiability - kom;
  }

  if (hasBackBet && !hasLayBet) {
    if (b.wl === "WIN") return backStake * (backOdds - 1) - kom;
    if (b.wl === "LOSS") return -backStake - kom;
    return 0;
  }

  if (hasBackBet && hasLayBet) {
    if (b.wl === "WIN") {
      const backProfit = backStake * (backOdds - 1);
      return backProfit - layLiability - kom;
    } else {
      return -backStake + layStake - kom;
    }
  }

  return 0;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// --- CUSTOM MONTH SELECT ---

function MonthSelect({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  const getLabel = (m: string) => new Date(m + "-01").toLocaleDateString("sl-SI", { year: "numeric", month: "long" });

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all duration-200 capitalize
          ${isOpen 
            ? "bg-zinc-900 border-emerald-500/50 text-white shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]" 
            : "bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700 hover:text-white"}
        `}
      >
        <span>{getLabel(value)}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-emerald-500" : ""}`} />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}

      {/* Dropdown Options */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar py-1">
            {options.map((month) => (
              <button
                key={month}
                onClick={() => {
                  onChange(month);
                  setIsOpen(false);
                }}
                className={`
                  w-full text-left px-4 py-2.5 text-sm font-medium transition-colors capitalize border-l-2
                  ${month === value 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500" 
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white border-transparent"}
                `}
              >
                {getLabel(month)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- OSTALE KOMPONENTE UI ---

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 group">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
        {icon}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm placeholder-zinc-700 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all duration-200"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 group">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
        {icon}
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm appearance-none focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all duration-200 cursor-pointer pr-8"
        >
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-zinc-900 text-white">
              {opt}
            </option>
          ))}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
           <ChevronDown className="w-4 h-4" />
        </div>
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
  } as const;

  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-bold border ${styles[wl]} transition-all duration-300 hover:brightness-125 cursor-pointer`}
    >
      {wl}
    </button>
  );
}

function TooltipCell({ text, className = "" }: { text: string; className?: string }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <span className={`block truncate cursor-default ${className}`}>{text}</span>
      {showTooltip && text.length > 12 && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl whitespace-nowrap">
          <span className="text-sm text-white">{text}</span>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800"></div>
        </div>
      )}
    </div>
  );
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
  const [vplacilo2, setVplacilo2] = useState("");
  const [komisija, setKomisija] = useState("0");
  const [tipster, setTipster] = useState<(typeof TIPSTERJI)[number]>("DAVID");
  const [stavnica, setStavnica] = useState<(typeof STAVNICE)[number]>("SHARP");

  // Edit states
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

  useEffect(() => {
    if (mode === "TRADING") return;
    if (betSide === "BACK") {
      setLayKvota("");
      setVplacilo2("");
    } else {
      setKvota1("");
      setVplacilo1("");
    }
  }, [mode, betSide]);

  async function loadBets() {
    setLoading(true);
    setMsg(null);
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: false }).order("created_at", { ascending: false });
    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }
    setRows((data || []) as BetRow[]);
    setLoading(false);
  }

  function resetForm() {
    setWl("OPEN");
    setDogodek("");
    setTip("");
    setMode("BET");
    setBetSide("BACK");
    setKvota1("");
    setVplacilo1("");
    setLayKvota("");
    setVplacilo2("");
    setKomisija("0");
  }

  async function addBet() {
    setMsg(null);
    if (!dogodek.trim() || !tip.trim()) { setMsg("Manjka dogodek ali tip."); return; }
    
    const backOdds = parseNum(kvota1);
    const backStake = parseNum(vplacilo1);
    const layOdds = parseNum(layKvota);
    const layStake = parseNum(vplacilo2);

    if (mode === "TRADING") {
      if (!(backOdds > 1 && backStake > 0 && layOdds > 1 && layStake > 0)) {
        setMsg("Trading zahteva BACK in LAY (kvota > 1 in vplačilo > 0).");
        return;
      }
    } else {
      if (betSide === "BACK") {
        if (!(backOdds > 1 && backStake > 0)) { setMsg("Navadna BACK stava zahteva Back kvoto (>1) in vplačilo (>0)."); return; }
      } else {
        if (!(layOdds > 1 && layStake > 0)) { setMsg("Navadna LAY stava zahteva Lay kvoto (>1) in vplačilo (>0)."); return; }
      }
    }

    const payload: any = {
      datum, wl, dogodek: dogodek.trim(), tip: tip.trim(), komisija: komisija.trim() !== "" ? parseNum(komisija) : 0,
      sport, cas_stave: casStave, tipster, stavnica, created_by: user?.id || null, mode,
    };

    if (mode === "TRADING") {
      payload.kvota1 = backOdds; payload.vplacilo1 = backStake; payload.lay_kvota = layOdds; payload.vplacilo2 = layStake;
    } else {
      if (betSide === "BACK") {
        payload.kvota1 = backOdds; payload.vplacilo1 = backStake; payload.lay_kvota = 0; payload.vplacilo2 = 0;
      } else {
        payload.kvota1 = 0; payload.vplacilo1 = 0; payload.lay_kvota = layOdds; payload.vplacilo2 = layStake;
      }
    }

    const { data, error } = await supabase.from("bets").insert(payload).select("*").single();
    if (error) { setMsg(error.message); return; }
    setRows((prev) => [data as BetRow, ...prev]);
    resetForm();
  }

  async function deleteBet(id: string) {
    if (!confirm("Si prepričan, da želiš izbrisati to stavo?")) return;
    setMsg(null);
    const { error } = await supabase.from("bets").delete().eq("id", id);
    if (error) { setMsg(error.message); return; }
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
    if (error) { setMsg(error.message); return; }
    setRows((prev) => prev.map((r) => (r.id === editId ? { ...r, wl: editWl } : r)));
    setEditOpen(false);
    setEditId(null);
  }

  const filteredRows = useMemo(() => rows.filter((r) => r.datum.startsWith(selectedMonth)), [rows, selectedMonth]);
  const computed = useMemo(() => ({ withProfit: filteredRows.map((r) => ({ ...r, profit: calcProfit(r) })) }), [filteredRows]);
  const availableMonths = useMemo(() => {
    const months = new Set(rows.map((r) => r.datum.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [rows]);

  const monthlyStats = useMemo(() => {
    const settled = computed.withProfit.filter((r) => r.wl === "WIN" || r.wl === "LOSS");
    const profit = settled.reduce((acc, r) => acc + r.profit, 0);
    const wins = settled.filter((r) => r.wl === "WIN").length;
    const losses = settled.filter((r) => r.wl === "LOSS").length;
    const openCount = computed.withProfit.filter((r) => r.wl === "OPEN").length;
    return { profit, wins, losses, openCount };
  }, [computed.withProfit]);

  if (loading && rows.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>

      <div className="relative max-w-[1800px] mx-auto px-4 md:px-6 py-8 md:py-12">
        
        {/* HEADER - SAMO REFRESH (Filter odstranjen) */}
        <div className="flex justify-end mb-6 mt-4 h-10">
          <button
            onClick={loadBets}
            className="group p-2.5 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all duration-200 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
          </button>
        </div>

        {msg && <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm text-center">{msg}</div>}

        {/* ADD FORM */}
        <section className="mb-10 relative z-10">
          <div className="rounded-3xl border border-zinc-800/60 bg-gradient-to-b from-zinc-900 to-black p-1 shadow-2xl">
            <div className="rounded-[20px] bg-zinc-900/50 p-6 backdrop-blur-md">
              
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-zinc-800/50">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Plus className="w-4 h-4 text-emerald-500" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-300">Nova Stava</h2>
              </div>

              {/* Vnosna polja */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <InputField label="Datum" value={datum} onChange={setDatum} type="date" icon={<Calendar className="w-3 h-3" />} />
                <SelectField label="Status" value={wl} onChange={(v) => setWl(v as WL)} options={["OPEN", "WIN", "LOSS", "VOID"]} icon={<Trophy className="w-3 h-3" />} />
                <SelectField label="Šport" value={sport} onChange={(v) => setSport(v as typeof sport)} options={SPORTI} icon={<Target className="w-3 h-3" />} />
                <SelectField label="Čas" value={casStave} onChange={(v) => setCasStave(v as PreLive)} options={PRELIVE} icon={<Clock className="w-3 h-3" />} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <InputField label="Dogodek" value={dogodek} onChange={setDogodek} placeholder="Home : Away" />
                <InputField label="Tip" value={tip} onChange={setTip} placeholder="npr. Over 2.5" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <SelectField label="Tip vnosa" value={mode} onChange={(v) => setMode(v as Mode)} options={MODES} icon={<Activity className="w-3 h-3" />} />
                {mode === "BET" ? (
                  <SelectField label="Stava" value={betSide} onChange={(v) => setBetSide(v as BetSide)} options={BET_SIDES} icon={<Target className="w-3 h-3" />} />
                ) : <div className="hidden md:block" />}
                <InputField label="Komisija (%)" value={komisija} onChange={setKomisija} placeholder="0" icon={<Percent className="w-3 h-3" />} />
                <div className="hidden md:block" />
              </div>

              {(mode === "TRADING" || (mode === "BET" && betSide === "BACK")) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 p-4 rounded-xl bg-zinc-950/30 border border-zinc-800/30">
                  <InputField label="Back Kvota" value={kvota1} onChange={setKvota1} placeholder="2.00" icon={<TrendingUp className="w-3 h-3 text-emerald-500" />} />
                  <InputField label="Back Vplačilo" value={vplacilo1} onChange={setVplacilo1} placeholder="100" icon={<DollarSign className="w-3 h-3 text-emerald-500" />} />
                  {mode === "TRADING" ? (
                    <>
                      <InputField label="Lay Kvota" value={layKvota} onChange={setLayKvota} placeholder="2.00" icon={<TrendingUp className="w-3 h-3 text-rose-500" />} />
                      <InputField label="Lay Vplačilo" value={vplacilo2} onChange={setVplacilo2} placeholder="100" icon={<DollarSign className="w-3 h-3 text-rose-500" />} />
                    </>
                  ) : <><div className="hidden md:block" /><div className="hidden md:block" /></>}
                </div>
              )}

              {mode === "BET" && betSide === "LAY" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 p-4 rounded-xl bg-zinc-950/30 border border-zinc-800/30">
                  <InputField label="Lay Kvota" value={layKvota} onChange={setLayKvota} placeholder="2.00" icon={<TrendingUp className="w-3 h-3 text-rose-500" />} />
                  <InputField label="Lay Vplačilo" value={vplacilo2} onChange={setVplacilo2} placeholder="100" icon={<DollarSign className="w-3 h-3 text-rose-500" />} />
                  <div className="hidden md:block" /><div className="hidden md:block" />
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <SelectField label="Tipster" value={tipster} onChange={(v) => setTipster(v as typeof tipster)} options={TIPSTERJI} icon={<Users className="w-3 h-3" />} />
                <SelectField label="Stavnica" value={stavnica} onChange={(v) => setStavnica(v as typeof stavnica)} options={STAVNICE} icon={<Building2 className="w-3 h-3" />} />
                <div className="hidden md:block" />
                <button
                  onClick={addBet}
                  className="w-full h-[42px] flex items-center justify-center gap-2 bg-emerald-500 text-black text-sm font-bold rounded-lg hover:bg-emerald-400 transition-all duration-200 shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  Dodaj Stavo
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* MONTH STATS & FILTER (Vrnjeno nazaj sem) */}
        <section className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          
          {/* FILTER MESECA - SPET TUKAJ + Z-INDEX FIX */}
          <div className="col-span-2 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-4 flex items-center gap-4 group relative z-50">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-800 text-zinc-400 group-focus-within:text-emerald-500 transition-colors">
               <Filter className="w-5 h-5" />
            </div>
            <div className="flex-1 relative">
               <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 block mb-1">Filter Meseca</label>
               {/* CUSTOM MONTH SELECT */}
               <MonthSelect 
                  value={selectedMonth} 
                  onChange={setSelectedMonth} 
                  options={availableMonths} 
               />
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 backdrop-blur-sm p-4 text-center">
            <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-400/80 block mb-1">Profit</span>
            <span className={`text-xl font-bold ${monthlyStats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eur(monthlyStats.profit)}</span>
          </div>

          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-4 text-center">
            <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 block mb-1">W / L</span>
            <span className="text-xl font-bold text-white">
              <span className="text-emerald-400">{monthlyStats.wins}</span>
              <span className="text-zinc-600 mx-1">/</span>
              <span className="text-rose-400">{monthlyStats.losses}</span>
            </span>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 backdrop-blur-sm p-4 text-center">
            <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400/80 block mb-1">Odprte</span>
            <span className="text-xl font-bold text-amber-400">{monthlyStats.openCount}</span>
          </div>
        </section>

        {/* TABLE */}
        <section className="rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm overflow-hidden relative z-0">
          <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <Activity className="w-4 h-4 text-zinc-400" />
               <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-300">Seznam Stav</h2>
            </div>
            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900/80 border border-zinc-800 px-2 py-1 rounded-md">{computed.withProfit.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 whitespace-nowrap">Datum</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500">Status</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500">Mode</th>
                  <th className="text-center py-4 px-4 font-bold tracking-wider uppercase text-zinc-500" style={{ minWidth: "180px" }}>Dogodek</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500">Back</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500">Vplač.</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500">Lay</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500">Vplač.</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500">Kom.</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 whitespace-nowrap">Profit</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500">Tipster / Šport</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500">Stavnica</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500">Akcija</th>
                </tr>
              </thead>

              <tbody>
                {computed.withProfit.map((r, idx) => {
                  const rowMode: Mode = (r.mode as Mode) || (hasBack(r) && hasLay(r) ? "TRADING" : "BET");

                  return (
                    <tr key={r.id} className={`border-b border-zinc-800/30 hover:bg-zinc-800/40 transition-colors group ${idx % 2 === 0 ? "bg-zinc-900/20" : "bg-transparent"}`}>
                      <td className="py-3 px-3 text-zinc-400 text-center whitespace-nowrap">{formatDateSlovenian(r.datum)}</td>
                      <td className="py-3 px-3 text-center"><StatusBadge wl={r.wl} onClick={() => openEdit(r)} /></td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${rowMode === "TRADING" ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-sky-500/10 text-sky-400 border-sky-500/20"}`}>{rowMode}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="space-y-0.5">
                          <TooltipCell text={r.dogodek} className="text-white font-medium" />
                          <TooltipCell text={r.tip} className="text-zinc-500 text-xs" />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-zinc-300 font-medium text-center">{r.kvota1 > 0 ? r.kvota1.toFixed(2) : "-"}</td>
                      <td className="py-3 px-3 text-zinc-400 text-center">{r.vplacilo1 > 0 ? eurCompact(r.vplacilo1) : "-"}</td>
                      <td className="py-3 px-3 text-rose-300 font-medium text-center">{(r.lay_kvota ?? 0) > 0 ? (r.lay_kvota ?? 0).toFixed(2) : "-"}</td>
                      <td className="py-3 px-3 text-zinc-400 text-center">{(r.vplacilo2 ?? 0) > 0 ? eurCompact(r.vplacilo2 ?? 0) : "-"}</td>
                      <td className="py-3 px-3 text-zinc-500 text-center">{(r.komisija ?? 0) > 0 ? eurCompact(r.komisija ?? 0) : "-"}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-mono font-bold ${r.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eurCompact(r.profit)}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                           <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded">{r.tipster}</span>
                           <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">{r.sport}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-zinc-400 text-center text-xs">{r.stavnica}</td>
                      
                      <td className="py-3 px-2 text-center">
                         <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-blue-500/20 text-zinc-400 hover:text-blue-400 transition-colors" title="Uredi rezultat">
                               <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteBet(r.id)} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors" title="Izbriši">
                               <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-12 pt-8 border-t border-zinc-900 text-center flex flex-col md:flex-row justify-between items-center text-zinc-600 text-xs gap-2">
          <p>© 2024 DDTips Analytics. Vse pravice pridržane.</p>
          <p className="font-mono">Last updated: {new Date().toLocaleTimeString()}</p>
        </footer>
      </div>

      {/* EDIT MODAL */}
      {editOpen && (
        <div onClick={() => setEditOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Zaključi stavo</h3>
              <button onClick={() => setEditOpen(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <div className="mb-8">
              <label className="block text-xs font-bold tracking-widest uppercase text-zinc-500 mb-4 text-center">Izberi nov status</label>
              <div className="grid grid-cols-4 gap-2">
                {(["OPEN", "WIN", "LOSS", "VOID"] as WL[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setEditWl(status)}
                    className={`px-2 py-4 rounded-xl text-xs font-bold transition-all duration-300 border ${
                      editWl === status
                        ? status === "WIN"
                          ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]"
                          : status === "LOSS"
                          ? "bg-rose-500 text-white border-rose-400 shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)]"
                          : status === "VOID"
                          ? "bg-zinc-500 text-white border-zinc-400"
                          : "bg-amber-500 text-white border-amber-400"
                        : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditOpen(false)} className="flex-1 px-6 py-3 bg-zinc-950 border border-zinc-800 text-zinc-300 font-bold rounded-xl hover:bg-zinc-900 transition-all duration-300">
                Prekliči
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all duration-300"
              >
                <Check className="w-4 h-4" />
                Potrdi
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}