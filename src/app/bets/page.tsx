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
  Check
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

function calcProfit(b: BetRow) {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;

  const kom = Number(b.komisija ?? 0);
  
  const isPureLay = (!b.kvota1 || b.kvota1 === 0 || !b.vplacilo1 || b.vplacilo1 === 0) && 
                     (b.lay_kvota ?? 0) > 0 && (b.vplacilo2 ?? 0) > 0;
  
  if (isPureLay) {
    const layOdds = Number(b.lay_kvota || 0);
    const layStake = Number(b.vplacilo2 || 0);
    const liability = (layOdds - 1) * layStake;
    
    if (b.wl === "WIN") {
      return layStake - kom;
    } else {
      return -liability - kom;
    }
  }

  const stake = Number(b.vplacilo1 || 0);
  const odds = Number(b.kvota1 || 0);
  const hasLay = (b.lay_kvota ?? 0) > 0 && (b.vplacilo2 ?? 0) > 0;
  const layOdds = Number(b.lay_kvota || 0);
  const layStake = Number(b.vplacilo2 || 0);
  const layLiability = hasLay ? (layOdds - 1) * layStake : 0;

  if (b.wl === "WIN") {
    const backProfit = (odds - 1) * stake;
    return backProfit - layLiability - kom;
  }

  const base = -stake + (hasLay ? layStake : 0);
  return base - kom;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function InputField({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  type = "text",
  icon
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
        {icon}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-900 transition-all duration-300"
      />
    </div>
  );
}

function SelectField({ 
  label, 
  value, 
  onChange, 
  options,
  icon
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  options: readonly string[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
        {icon}
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800/50 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-900 transition-all duration-300 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function StatusBadge({ wl, onClick }: { wl: WL; onClick?: () => void }) {
  const styles = {
    WIN: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    LOSS: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    VOID: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    OPEN: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${styles[wl]} transition-all duration-300 hover:scale-105 cursor-pointer`}
    >
      {wl}
    </button>
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
    const withProfit = filteredRows.map((r) => ({ ...r, profit: calcProfit(r) }));
    return { withProfit };
  }, [filteredRows]);

  const availableMonths = useMemo(() => {
    const months = new Set(rows.map(r => r.datum.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [rows]);

  function getDisplayOdds(r: BetRow) {
    const isPureLay = (!r.kvota1 || r.kvota1 === 0) && (r.lay_kvota ?? 0) > 0;
    return isPureLay ? r.lay_kvota : r.kvota1;
  }

  function getDisplayStake(r: BetRow) {
    const isPureLay = (!r.kvota1 || r.kvota1 === 0 || !r.vplacilo1 || r.vplacilo1 === 0) && (r.vplacilo2 ?? 0) > 0;
    return isPureLay ? r.vplacilo2 : r.vplacilo1;
  }

  // Calculate monthly stats
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
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-zinc-500 text-sm tracking-widest uppercase">Nalagam...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white antialiased">
      {/* Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black" />
      <div className="fixed inset-0 opacity-30" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")" }} />
      
      <div className="relative max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white mb-1">Stave</h1>
            <p className="text-sm text-zinc-500">Prijavljen kot: {user?.email || "-"}</p>
          </div>
          <button
            onClick={loadBets}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800/50 rounded-xl text-zinc-400 hover:text-white hover:border-zinc-700 transition-all duration-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="text-sm font-medium">Osveži</span>
          </button>
        </header>

        {/* Error message */}
        {msg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {msg}
          </div>
        )}

        {/* Add Bet Form */}
        <section className="mb-8">
          <div className="rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Plus className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-zinc-300">Dodaj stavo</h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-4 gap-4 mb-4">
                <InputField
                  label="Datum"
                  value={datum}
                  onChange={setDatum}
                  type="date"
                  icon={<Calendar className="w-3 h-3" />}
                />
                <SelectField
                  label="Status"
                  value={wl}
                  onChange={(v) => setWl(v as WL)}
                  options={["OPEN", "WIN", "LOSS", "VOID"]}
                  icon={<Trophy className="w-3 h-3" />}
                />
                <SelectField
                  label="Šport"
                  value={sport}
                  onChange={(v) => setSport(v as typeof sport)}
                  options={SPORTI}
                  icon={<Target className="w-3 h-3" />}
                />
                <SelectField
                  label="Čas"
                  value={casStave}
                  onChange={(v) => setCasStave(v as PreLive)}
                  options={PRELIVE}
                  icon={<Clock className="w-3 h-3" />}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <InputField
                  label="Dogodek"
                  value={dogodek}
                  onChange={setDogodek}
                  placeholder="npr. Dinamo : Hajduk"
                />
                <InputField
                  label="Tip"
                  value={tip}
                  onChange={setTip}
                  placeholder="npr. Dinamo to win"
                />
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4">
                <InputField
                  label="Back Kvota"
                  value={kvota1}
                  onChange={setKvota1}
                  placeholder="2.00"
                  icon={<TrendingUp className="w-3 h-3" />}
                />
                <InputField
                  label="Back Vplačilo"
                  value={vplacilo1}
                  onChange={setVplacilo1}
                  placeholder="100"
                  icon={<DollarSign className="w-3 h-3" />}
                />
                <InputField
                  label="Lay Kvota"
                  value={layKvota}
                  onChange={setLayKvota}
                  placeholder="1.05"
                  icon={<TrendingUp className="w-3 h-3" />}
                />
                <InputField
                  label="Lay Vplačilo"
                  value={vplacilo2}
                  onChange={setVplacilo2}
                  placeholder="100"
                  icon={<DollarSign className="w-3 h-3" />}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <InputField
                  label="Komisija"
                  value={komisija}
                  onChange={setKomisija}
                  placeholder="0"
                />
                <SelectField
                  label="Tipster"
                  value={tipster}
                  onChange={(v) => setTipster(v as typeof tipster)}
                  options={TIPSTERJI}
                  icon={<Users className="w-3 h-3" />}
                />
                <SelectField
                  label="Stavnica"
                  value={stavnica}
                  onChange={(v) => setStavnica(v as typeof stavnica)}
                  options={STAVNICE}
                  icon={<Building2 className="w-3 h-3" />}
                />
                <div className="flex items-end">
                  <button
                    onClick={addBet}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold rounded-xl hover:from-emerald-500 hover:to-emerald-400 transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.02]"
                  >
                    <Plus className="w-4 h-4" />
                    Dodaj stavo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Month Filter & Stats */}
        <section className="mb-6 grid grid-cols-5 gap-4">
          {/* Filter */}
          <div className="col-span-2 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <Filter className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">Filter po mesecu</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800/50 rounded-xl text-white font-medium focus:outline-none focus:border-emerald-500/50 transition-all duration-300 cursor-pointer"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {new Date(month + '-01').toLocaleDateString('sl-SI', { year: 'numeric', month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          {/* Monthly Stats */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 backdrop-blur-sm p-5">
            <span className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400 block mb-2">Profit</span>
            <span className={`text-2xl font-light ${monthlyStats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {eur(monthlyStats.profit)}
            </span>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-sm p-5">
            <span className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400 block mb-2">Win / Loss</span>
            <span className="text-2xl font-light text-white">
              <span className="text-emerald-400">{monthlyStats.wins}</span>
              <span className="text-zinc-600 mx-1">/</span>
              <span className="text-rose-400">{monthlyStats.losses}</span>
            </span>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 backdrop-blur-sm p-5">
            <span className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400 block mb-2">Odprte</span>
            <span className="text-2xl font-light text-amber-400">{monthlyStats.openCount}</span>
          </div>
        </section>

        {/* Table */}
        <section className="rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-zinc-300">Vse stave</h2>
            </div>
            <span className="text-xs text-zinc-500">{computed.withProfit.length} vrstic</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="text-left py-4 px-5 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500">Datum</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500">Status</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500">Dogodek</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500">Tip</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500">Kvota</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500">Vplačilo</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500">Profit</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500">Šport</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500">Tipster</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500">Stavnica</th>
                  <th className="text-right py-4 px-5 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500"></th>
                </tr>
              </thead>
              <tbody>
                {computed.withProfit.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-800/30 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4 px-5 text-sm text-zinc-300">{formatDateSlovenian(r.datum)}</td>
                    <td className="py-4 px-5">
                      <StatusBadge wl={r.wl} onClick={() => openEdit(r)} />
                    </td>
                    <td className="py-4 px-5 text-sm text-white font-medium">{r.dogodek}</td>
                    <td className="py-4 px-5 text-sm text-zinc-400">{r.tip}</td>
                    <td className="py-4 px-5 text-sm text-white font-semibold tabular-nums">{getDisplayOdds(r) || '-'}</td>
                    <td className="py-4 px-5 text-sm text-zinc-300 tabular-nums">{eur(getDisplayStake(r) || 0)}</td>
                    <td className={`py-4 px-5 text-sm font-semibold tabular-nums ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {eur(r.profit)}
                    </td>
                    <td className="py-4 px-5 text-sm text-zinc-500">{r.sport}</td>
                    <td className="py-4 px-5 text-sm text-zinc-300">{r.tipster}</td>
                    <td className="py-4 px-5 text-sm text-zinc-300">{r.stavnica}</td>
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={() => deleteBet(r.id)}
                        className="p-2 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all duration-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {!computed.withProfit.length && (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-600">
                      Ni stav za izbrani mesec.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-zinc-800/50">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>DDTips Match Analysis & Picks</span>
            <span>Zadnja posodobitev: {new Date().toLocaleDateString("sl-SI")}</span>
          </div>
        </footer>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div
          onClick={() => setEditOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Zapri stavo</h3>
              <button 
                onClick={() => setEditOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            
            <div className="mb-6">
              <label className="block text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400 mb-3">Rezultat</label>
              <div className="grid grid-cols-4 gap-2">
                {(["OPEN", "WIN", "LOSS", "VOID"] as WL[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setEditWl(status)}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      editWl === status 
                        ? status === "WIN" 
                          ? "bg-emerald-500 text-white" 
                          : status === "LOSS" 
                          ? "bg-rose-500 text-white"
                          : status === "VOID"
                          ? "bg-zinc-500 text-white"
                          : "bg-amber-500 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 px-6 py-3 bg-zinc-800 text-zinc-300 font-semibold rounded-xl hover:bg-zinc-700 transition-all duration-300"
              >
                Prekliči
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 transition-all duration-300"
              >
                <Check className="w-4 h-4" />
                Shrani
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}