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
  Percent
} from "lucide-react";

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
    if (b.wl === "WIN") {
      return layStake - kom;
    } else {
      return -layLiability - kom;
    }
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

function calcEffectiveOdds(b: BetRow): number | null {
  const hasBackBet = hasBack(b);
  const hasLayBet = hasLay(b);

  const backStake = b.vplacilo1 || 0;
  const backOdds = b.kvota1 || 0;
  const layStake = b.vplacilo2 || 0;
  const layOdds = b.lay_kvota || 0;
  const layLiability = (layOdds - 1) * layStake;
  const kom = Number(b.komisija ?? 0);

  if (hasBackBet && !hasLayBet) {
    return backOdds;
  }
  
  if (!hasBackBet && hasLayBet) {
    if (layLiability <= 0) return null;
    const profit = layStake - kom;
    return 1 + profit / layLiability;
  }
  
  if (hasBackBet && hasLayBet) {
    if (layLiability <= 0) return null;
    const backProfit = backStake * (backOdds - 1);
    const profitOnWin = backProfit - layLiability - kom;
    return 1 + profitOnWin / layLiability;
  }
  
  return null;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function InputField({ label, value, onChange, placeholder, type = "text", icon }: { 
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest uppercase text-zinc-500">
        {icon}{label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl text-white text-center placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all duration-300"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, icon }: { 
  label: string; value: string; onChange: (v: string) => void; options: readonly string[]; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest uppercase text-zinc-500">
        {icon}{label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl text-white text-center focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all duration-300 cursor-pointer appearance-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>
        ))}
      </select>
    </div>
  );
}

function StatusBadge({ wl, onClick }: { wl: WL; onClick?: () => void }) {
  const styles = {
    WIN: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    LOSS: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    VOID: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
    OPEN: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  };

  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${styles[wl]} transition-all duration-300 hover:scale-105 cursor-pointer`}
    >
      {wl}
    </button>
  );
}

function TooltipCell({ text, className = "" }: { text: string; className?: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className={`block truncate cursor-default ${className}`}>
        {text}
      </span>
      {showTooltip && text.length > 12 && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl whitespace-nowrap">
          <span className="text-sm text-white">{text}</span>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800"></div>
        </div>
      )}
    </div>
  );
}

export default function BetsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [wl, setWl] = useState<WL>("OPEN");
  const [sport, setSport] = useState<(typeof SPORTI)[number]>("NOGOMET");
  const [casStave, setCasStave] = useState<PreLive>("PREMATCH");
  const [dogodek, setDogodek] = useState("");
  const [tip, setTip] = useState("");
  const [kvota1, setKvota1] = useState("");
  const [vplacilo1, setVplacilo1] = useState("");
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
    setKvota1("");
    setVplacilo1("");
    setLayKvota("");
    setVplacilo2("");
    setKomisija("0");
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

  const filteredRows = useMemo(() => {
    return rows.filter(r => r.datum.startsWith(selectedMonth));
  }, [rows, selectedMonth]);

  const computed = useMemo(() => {
    const withProfit = filteredRows.map((r) => ({ 
      ...r, 
      profit: calcProfit(r),
      effectiveOdds: calcEffectiveOdds(r)
    }));
    return { withProfit };
  }, [filteredRows]);

  const availableMonths = useMemo(() => {
    const months = new Set(rows.map(r => r.datum.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [rows]);

  const monthlyStats = useMemo(() => {
    const settled = computed.withProfit.filter(r => r.wl === "WIN" || r.wl === "LOSS");
    const profit = settled.reduce((acc, r) => acc + r.profit, 0);
    const wins = settled.filter(r => r.wl === "WIN").length;
    const losses = settled.filter(r => r.wl === "LOSS").length;
    const openCount = computed.withProfit.filter(r => r.wl === "OPEN").length;
    return { profit, wins, losses, openCount, total: settled.length };
  }, [computed.withProfit]);

  if (loading && rows.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-zinc-500 text-xs font-bold tracking-widest uppercase animate-pulse">Loading Data</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />
      
      <div className="relative max-w-[1800px] mx-auto px-4 md:px-6 py-8 md:py-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <Plus className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-xs font-bold text-emerald-500 tracking-widest uppercase">Bet Management</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
              Stave <span className="text-zinc-600">Manager</span>
            </h1>
            <p className="text-zinc-400 font-medium">Prijavljen kot: {user?.email || "-"}</p>
          </div>
          
          <button
            onClick={loadBets}
            className="group p-3 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all duration-200 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] self-center md:self-auto"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
          </button>
        </header>

        {msg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm text-center">
            {msg}
          </div>
        )}

        <section className="mb-8">
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Plus className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-300">Dodaj stavo</h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <InputField label="Datum" value={datum} onChange={setDatum} type="date" icon={<Calendar className="w-3 h-3" />} />
                <SelectField label="Status" value={wl} onChange={(v) => setWl(v as WL)} options={["OPEN", "WIN", "LOSS", "VOID"]} icon={<Trophy className="w-3 h-3" />} />
                <SelectField label="Šport" value={sport} onChange={(v) => setSport(v as typeof sport)} options={SPORTI} icon={<Target className="w-3 h-3" />} />
                <SelectField label="Čas" value={casStave} onChange={(v) => setCasStave(v as PreLive)} options={PRELIVE} icon={<Clock className="w-3 h-3" />} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <InputField label="Dogodek" value={dogodek} onChange={setDogodek} placeholder="Home : Away" />
                <InputField label="Tip" value={tip} onChange={setTip} placeholder="" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <InputField label="Back Kvota" value={kvota1} onChange={setKvota1} placeholder="2" icon={<TrendingUp className="w-3 h-3" />} />
                <InputField label="Back Vplačilo" value={vplacilo1} onChange={setVplacilo1} placeholder="100" icon={<DollarSign className="w-3 h-3" />} />
                <InputField label="Lay Kvota" value={layKvota} onChange={setLayKvota} placeholder="2" icon={<TrendingUp className="w-3 h-3" />} />
                <InputField label="Lay Vplačilo" value={vplacilo2} onChange={setVplacilo2} placeholder="100" icon={<DollarSign className="w-3 h-3" />} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputField label="Komisija" value={komisija} onChange={setKomisija} placeholder="0" icon={<Percent className="w-3 h-3" />} />
                <SelectField label="Tipster" value={tipster} onChange={(v) => setTipster(v as typeof tipster)} options={TIPSTERJI} icon={<Users className="w-3 h-3" />} />
                <SelectField label="Stavnica" value={stavnica} onChange={(v) => setStavnica(v as typeof stavnica)} options={STAVNICE} icon={<Building2 className="w-3 h-3" />} />
                <div className="flex items-end">
                  <button onClick={addBet} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all duration-300 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)]">
                    <Plus className="w-4 h-4" />
                    Dodaj
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="col-span-2 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-5">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Filter className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold tracking-widest uppercase text-zinc-500">Filter po mesecu</span>
            </div>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl text-white font-medium text-center focus:outline-none focus:border-emerald-500/50 transition-all duration-300 cursor-pointer">
              {availableMonths.map(month => (
                <option key={month} value={month} className="bg-zinc-900">
                  {new Date(month + '-01').toLocaleDateString('sl-SI', { year: 'numeric', month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 backdrop-blur-sm p-5 text-center">
            <span className="text-xs font-bold tracking-widest uppercase text-emerald-400/80 block mb-2">Profit</span>
            <span className={`text-2xl font-bold ${monthlyStats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eur(monthlyStats.profit)}</span>
          </div>

          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-5 text-center">
            <span className="text-xs font-bold tracking-widest uppercase text-zinc-500 block mb-2">Win / Loss</span>
            <span className="text-2xl font-bold text-white">
              <span className="text-emerald-400">{monthlyStats.wins}</span>
              <span className="text-zinc-600 mx-1">/</span>
              <span className="text-rose-400">{monthlyStats.losses}</span>
            </span>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 backdrop-blur-sm p-5 text-center">
            <span className="text-xs font-bold tracking-widest uppercase text-amber-400/80 block mb-2">Odprte</span>
            <span className="text-2xl font-bold text-amber-400">{monthlyStats.openCount}</span>
          </div>
        </section>

        <section className="rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-center gap-3">
            <Activity className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-300">Vse stave</h2>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-3 py-1 rounded-full ml-2">{computed.withProfit.length} vrstic</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                  <th className="text-center py-3 px-2 font-bold tracking-wider uppercase text-zinc-500 whitespace-nowrap">Datum</th>
                  <th className="text-center py-3 px-1 font-bold tracking-wider uppercase text-zinc-500">Status</th>
                  <th className="text-left py-3 px-2 font-bold tracking-wider uppercase text-zinc-500" style={{minWidth: '160px'}}>Dogodek</th>
                  <th className="text-left py-3 px-2 font-bold tracking-wider uppercase text-zinc-500" style={{minWidth: '140px'}}>Tip</th>
                  <th className="text-center py-3 px-1 font-bold tracking-wider uppercase text-zinc-500">Back</th>
                  <th className="text-center py-3 px-1 font-bold tracking-wider uppercase text-zinc-500">Vplač.</th>
                  <th className="text-center py-3 px-1 font-bold tracking-wider uppercase text-zinc-500">Lay</th>
                  <th className="text-center py-3 px-1 font-bold tracking-wider uppercase text-zinc-500">Vplač.</th>
                  <th className="text-center py-3 px-1 font-bold tracking-wider uppercase text-zinc-500">Efekt.</th>
                  <th className="text-center py-3 px-1 font-bold tracking-wider uppercase text-zinc-500">Kom.</th>
                  <th className="text-center py-3 px-2 font-bold tracking-wider uppercase text-zinc-500 whitespace-nowrap">Profit</th>
                  <th className="text-center py-3 px-1 font-bold tracking-wider uppercase text-zinc-500">Šport</th>
                  <th className="text-center py-3 px-1 font-bold tracking-wider uppercase text-zinc-500">Tipster</th>
                  <th className="text-right py-3 px-3 font-bold tracking-wider uppercase text-zinc-500">Stavnica</th>
                  <th className="w-[30px]"></th>
                </tr>
              </thead>
              <tbody>
                {computed.withProfit.map((r, idx) => (
                  <tr key={r.id} className={`border-b border-zinc-800/30 hover:bg-zinc-800/30 transition-colors group ${idx % 2 === 0 ? 'bg-zinc-900/20' : 'bg-zinc-900/40'}`}>
                    <td className="py-2.5 px-2 text-zinc-300 text-center whitespace-nowrap">{formatDateSlovenian(r.datum)}</td>
                    <td className="py-2.5 px-1 text-center"><StatusBadge wl={r.wl} onClick={() => openEdit(r)} /></td>
                    <td className="py-2.5 px-2 text-left" style={{maxWidth: '160px'}}>
                      <TooltipCell text={r.dogodek} className="text-white font-medium" />
                    </td>
                    <td className="py-2.5 px-2 text-left" style={{maxWidth: '140px'}}>
                      <TooltipCell text={r.tip} className="text-zinc-400" />
                    </td>
                    <td className="py-2.5 px-1 text-white font-semibold tabular-nums text-center">{r.kvota1 > 0 ? r.kvota1.toFixed(2) : '-'}</td>
                    <td className="py-2.5 px-1 text-zinc-300 tabular-nums text-center whitespace-nowrap">{r.vplacilo1 > 0 ? eurCompact(r.vplacilo1) : '-'}</td>
                    <td className="py-2.5 px-1 text-sky-400 font-semibold tabular-nums text-center">{(r.lay_kvota ?? 0) > 0 ? (r.lay_kvota ?? 0).toFixed(2) : '-'}</td>
                    <td className="py-2.5 px-1 text-sky-300 tabular-nums text-center whitespace-nowrap">{(r.vplacilo2 ?? 0) > 0 ? eurCompact(r.vplacilo2 ?? 0) : '-'}</td>
                    <td className="py-2.5 px-1 text-amber-400 font-semibold tabular-nums text-center">{r.effectiveOdds !== null ? r.effectiveOdds.toFixed(2) : '-'}</td>
                    <td className="py-2.5 px-1 text-zinc-500 tabular-nums text-center">{(r.komisija ?? 0) > 0 ? eurCompact(r.komisija ?? 0) : '-'}</td>
                    <td className={`py-2.5 px-2 font-bold tabular-nums text-center whitespace-nowrap ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{eurCompact(r.profit)}</td>
                    <td className="py-2.5 px-1 text-zinc-500 text-center">{r.sport}</td>
                    <td className="py-2.5 px-1 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-bold text-zinc-300 border border-zinc-700">{r.tipster}</span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 text-right">{r.stavnica}</td>
                    <td className="py-2.5 px-1 text-center">
                      <button onClick={() => deleteBet(r.id)} className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!computed.withProfit.length && (
                  <tr><td colSpan={15} className="py-12 text-center text-zinc-600">Ni stav za izbrani mesec.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-12 pt-8 border-t border-zinc-900 text-center flex flex-col md:flex-row justify-between items-center text-zinc-600 text-xs gap-2">
          <p>© 2024 DDTips Analytics. Vse pravice pridržane.</p>
          <p className="font-mono">Last updated: {new Date().toLocaleTimeString()}</p>
        </footer>
      </div>

      {editOpen && (
        <div onClick={() => setEditOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Zapri stavo</h3>
              <button onClick={() => setEditOpen(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            
            <div className="mb-6">
              <label className="block text-xs font-bold tracking-widest uppercase text-zinc-500 mb-3 text-center">Rezultat</label>
              <div className="grid grid-cols-4 gap-2">
                {(["OPEN", "WIN", "LOSS", "VOID"] as WL[]).map((status) => (
                  <button key={status} onClick={() => setEditWl(status)} className={`px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${editWl === status ? status === "WIN" ? "bg-emerald-500 text-white" : status === "LOSS" ? "bg-rose-500 text-white" : status === "VOID" ? "bg-zinc-500 text-white" : "bg-amber-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>{status}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditOpen(false)} className="flex-1 px-6 py-3 bg-zinc-800 text-zinc-300 font-bold rounded-xl hover:bg-zinc-700 transition-all duration-300">Prekliči</button>
              <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all duration-300"><Check className="w-4 h-4" />Shrani</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}