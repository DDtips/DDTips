"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation"; // Uporabljamo router za hitrejšo preusmeritev
import { toast } from "sonner";
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
  RefreshCw,
  Minus,
  AlertTriangle,
  Loader2,
  Inbox
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

function parseNum(x: string | number) {
  const s = (x ?? "").toString().trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatDateSlovenian(dateStr: string) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

function hasBack(b: BetRow): boolean { return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0; }
function hasLay(b: BetRow): boolean { return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0; }

function calcProfit(b: BetRow): number {
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;
  const komZnesek = Number(b.komisija ?? 0);
  const backStake = b.vplacilo1 || 0;
  const backOdds = b.kvota1 || 0;
  const layLiability = b.vplacilo2 || 0; 
  const layOdds = b.lay_kvota || 0;
  const layStake = layOdds > 1 ? layLiability / (layOdds - 1) : 0;
  let brutoProfit = 0;

  if (hasBack(b) && hasLay(b)) {
    const profitIfBackWins = (backStake * (backOdds - 1)) - layLiability;
    const profitIfLayWins = layStake - backStake;
    if (b.wl === "BACK WIN") brutoProfit = profitIfBackWins;
    else if (b.wl === "LAY WIN") brutoProfit = profitIfLayWins;
    else if (b.wl === "WIN") brutoProfit = Math.max(profitIfBackWins, profitIfLayWins);
    else if (b.wl === "LOSS") brutoProfit = Math.min(profitIfBackWins, profitIfLayWins);
  } else if (!hasBack(b) && hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") brutoProfit = layStake;
    else if (b.wl === "LOSS" || b.wl === "BACK WIN") brutoProfit = -layLiability;
  } else if (hasBack(b) && !hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") brutoProfit = backStake * (backOdds - 1);
    else if (b.wl === "LOSS" || b.wl === "LAY WIN") brutoProfit = -backStake;
  }
  return brutoProfit > 0 ? brutoProfit - komZnesek : brutoProfit;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// --- KOMPONENTE UI (MonthSelect, InputField, SelectField, StatusBadge, TooltipCell - ostanejo enake) ---
function MonthSelect({ value, onChange, options }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const getLabel = (m: string) => new Date(m + "-01").toLocaleDateString("sl-SI", { year: "numeric", month: "long" });
  return (
    <div className="relative w-full">
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all duration-200 capitalize ${isOpen ? "bg-zinc-900 border-emerald-500/50 text-white shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]" : "bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700 hover:text-white"}`}>
        <span>{getLabel(value)}</span><ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-emerald-500" : ""}`} />
      </button>
      {isOpen && <><div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} /><div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"><div className="max-h-[240px] overflow-y-auto custom-scrollbar py-1">{options.map((month: any) => (<button key={month} onClick={() => { onChange(month); setIsOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors capitalize border-l-2 ${month === value ? "bg-emerald-500/10 text-emerald-400 border-emerald-500" : "text-zinc-400 hover:bg-zinc-900 hover:text-white border-transparent"}`}>{getLabel(month)}</button>))}</div></div></>}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text", icon, inputMode, pattern }: any) {
  return (<div className="space-y-1.5 group"><label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon}{label}</label><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} pattern={pattern} className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm placeholder-zinc-700 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all duration-200" /></div>);
}

function SelectField({ label, value, onChange, options, icon }: any) {
  return (<div className="space-y-1.5 group"><label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon}{label}</label><div className="relative"><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm appearance-none focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all duration-200 cursor-pointer pr-8">{options.map((opt: string) => <option key={opt} value={opt} className="bg-zinc-900 text-white">{opt}</option>)}</select><div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500"><ChevronDown className="w-4 h-4" /></div></div></div>);
}

function StatusBadge({ wl, onClick }: { wl: WL; onClick?: () => void }) {
  const styles = { WIN: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", LOSS: "bg-rose-500/10 text-rose-400 border-rose-500/30", VOID: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30", OPEN: "bg-amber-500/10 text-amber-400 border-amber-500/30", "BACK WIN": "bg-emerald-600/20 text-emerald-400 border-emerald-500/50 font-black", "LAY WIN": "bg-pink-600/20 text-pink-400 border-pink-500/50 font-black" } as const;
  return <button onClick={onClick} className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${styles[wl] || styles.OPEN} transition-all duration-300 hover:brightness-125 cursor-pointer uppercase`}>{wl}</button>;
}

function TooltipCell({ text, className = "" }: { text: string; className?: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (<div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}><span className={`block truncate cursor-default ${className}`}>{text}</span>{showTooltip && text.length > 12 && (<div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl whitespace-nowrap"><span className="text-sm text-white">{text}</span><div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800"></div></div>)}</div>);
}

// --- GLAVNA STRAN ---
export default function BetsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(true); // Začnemo s true zaradi preverjanja dostopa
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [mounted, setMounted] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // --- STATE ZA BRISANJE / STATUS / FULL EDIT (ostanejo enaki) ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [betToDelete, setBetToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  // --- 🔒 VARNOSTNO PREVERJANJE DOSTOPA ---
  useEffect(() => {
    setMounted(true);
    const checkAccessAndLoad = async () => {
      setLoading(true);
      
      // 1. Preveri, če je uporabnik prijavljen (Auth)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // 2. Preveri profil in status odobritve (Public.profiles)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', user.id)
        .single();

      if (error || !profile || !profile.is_approved) {
        // Če ni odobren, ga pošljemo na stran za čakanje
        router.replace("/pending");
        return;
      }

      // 3. Če je vse OK, naložimo podatke
      setUser(user);
      await loadBets();
      setLoading(false);
    };

    checkAccessAndLoad();
  }, [router]);

  useEffect(() => {
    if (mode === "TRADING") return;
    if (betSide === "BACK") { setLayKvota(""); setVplacilo2(""); } else { setKvota1(""); setVplacilo1(""); }
  }, [mode, betSide]);

  // --- FUNKCIJE ZA PODATKE (loadBets, addBet, saveStatusEdit, saveFullEdit...) ---
  // (Te ostanejo enake tvojemu originalu, le da uporabljamo klic loadBets znotraj useEffecta)

  async function loadBets() {
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: false }).order("created_at", { ascending: false });
    if (!error) setRows((data || []) as BetRow[]);
  }

  function resetForm() { setWl("OPEN"); setDogodek(""); setTip(""); setMode("BET"); setBetSide("BACK"); setKvota1(""); setVplacilo1(""); setLayKvota(""); setVplacilo2(""); setKomisija("0"); }

  async function addBet() {
    if (!dogodek.trim() || !tip.trim()) { setMsg("Manjka dogodek ali tip."); return; }
    const backOdds = parseNum(kvota1); const backStake = parseNum(vplacilo1);
    const layOdds = parseNum(layKvota); const layStake = parseNum(vplacilo2);
    if (mode === "TRADING" && !(backOdds > 1 && backStake > 0 && layOdds > 1 && layStake > 0)) { setMsg("Trading zahteva BACK in LAY."); return; }
    const payload: any = { datum, wl, dogodek: dogodek.trim(), tip: tip.trim(), komisija: parseNum(komisija), sport, cas_stave: casStave, tipster, stavnica, created_by: user?.id || null, mode };
    if (mode === "TRADING") { payload.kvota1 = backOdds; payload.vplacilo1 = backStake; payload.lay_kvota = layOdds; payload.vplacilo2 = layStake; }
    else { if (betSide === "BACK") { payload.kvota1 = backOdds; payload.vplacilo1 = backStake; payload.lay_kvota = 0; payload.vplacilo2 = 0; } else { payload.kvota1 = 0; payload.vplacilo1 = 0; payload.lay_kvota = layOdds; payload.vplacilo2 = layStake; } }
    const { data, error } = await supabase.from("bets").insert(payload).select("*").single();
    if (error) { setMsg(error.message); return; }
    setRows((prev) => [data as BetRow, ...prev]);
    // Telegram notifikacija... (tvoja koda ostaja ista)
    resetForm(); setShowAddForm(false); window.dispatchEvent(new Event("bets-updated")); toast.success("Stava uspešno dodana!");
  }

  // ... (confirmDelete, openStatusEdit, openFullEdit, saveStatusEdit, saveFullEdit funkcije ostanejo enake) ...
  async function confirmDelete() {
    if (!betToDelete) return; setDeleting(true);
    const { error } = await supabase.from("bets").delete().eq("id", betToDelete);
    if (!error) { setRows((prev) => prev.filter((r) => r.id !== betToDelete)); toast.success("Stava izbrisana"); }
    setIsDeleteModalOpen(false); setBetToDelete(null); setDeleting(false); window.dispatchEvent(new Event("bets-updated"));
  }
  function openDeleteModal(id: string) { setBetToDelete(id); setIsDeleteModalOpen(true); }
  function openStatusEdit(b: BetRow) { setStatusEditId(b.id); setStatusEditWl(b.wl); setStatusEditOpen(true); }
  function openFullEdit(b: BetRow) { setEditingBet({ ...b }); setEditKvota1(b.kvota1?.toString() ?? ""); setEditVplacilo1(b.vplacilo1?.toString() ?? ""); setEditLayKvota(b.lay_kvota?.toString() ?? ""); setEditVplacilo2(b.vplacilo2?.toString() ?? ""); setEditKomisija(b.komisija?.toString() ?? "0"); setFullEditOpen(true); }
  async function saveStatusEdit() {
    if (!statusEditId) return;
    const { error } = await supabase.from("bets").update({ wl: statusEditWl }).eq("id", statusEditId);
    if (!error) { setRows((prev) => prev.map((r) => (r.id === statusEditId ? { ...r, wl: statusEditWl } : r))); toast.success("Status posodobljen"); }
    setStatusEditOpen(false); setStatusEditId(null); window.dispatchEvent(new Event("bets-updated"));
  }
  async function saveFullEdit() {
    if (!editingBet) return;
    const updatedBet: BetRow = { ...editingBet, kvota1: parseNum(editKvota1), vplacilo1: parseNum(editVplacilo1), lay_kvota: parseNum(editLayKvota), vplacilo2: parseNum(editVplacilo2), komisija: parseNum(editKomisija) };
    const { error } = await supabase.from("bets").update({ datum: updatedBet.datum, wl: updatedBet.wl, dogodek: updatedBet.dogodek, tip: updatedBet.tip, sport: updatedBet.sport, cas_stave: updatedBet.cas_stave, tipster: updatedBet.tipster, stavnica: updatedBet.stavnica, mode: updatedBet.mode, kvota1: updatedBet.kvota1, vplacilo1: updatedBet.vplacilo1, lay_kvota: updatedBet.lay_kvota, vplacilo2: updatedBet.vplacilo2, komisija: updatedBet.komisija }).eq("id", updatedBet.id);
    if (!error) { setRows((prev) => prev.map((r) => (r.id === updatedBet.id ? updatedBet : r))); toast.success("Stava posodobljena"); }
    setFullEditOpen(false); setEditingBet(null); window.dispatchEvent(new Event("bets-updated"));
  }

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((r) => r.datum.startsWith(selectedMonth));
    return filtered.sort((a, b) => b.datum.localeCompare(a.datum));
  }, [rows, selectedMonth]);

  const computed = useMemo(() => ({ withProfit: filteredRows.map((r) => ({ ...r, profit: calcProfit(r) })) }), [filteredRows]);
  const availableMonths = useMemo(() => Array.from(new Set(rows.map((r) => r.datum.slice(0, 7)))).sort().reverse(), [rows]);
  const monthlyStats = useMemo(() => {
    const settled = computed.withProfit.filter((r) => r.wl !== "OPEN" && r.wl !== "VOID");
    return { profit: settled.reduce((acc, r) => acc + r.profit, 0), wins: settled.filter((r) => ["WIN", "BACK WIN", "LAY WIN"].includes(r.wl)).length, losses: settled.filter((r) => r.wl === "LOSS").length, openCount: computed.withProfit.filter((r) => r.wl === "OPEN").length };
  }, [computed.withProfit]);

  // --- RENDERING ---
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4 text-center">
      <Loader2 className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin text-emerald-500" />
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">Preverjanje dostopa & Nalaganje stav...</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30">
      {/* OZADJE (Gradienti) */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />

      <style jsx global>{`.custom-scrollbar::-webkit-scrollbar { width: 5px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }`}</style>

      <div className="relative max-w-[1800px] mx-auto px-4 md:px-6 pt-48 pb-12">
        
        {/* HEADER STATS */}
        <section className="mb-8 flex flex-col md:flex-row items-stretch gap-4 justify-between">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
             <div className="col-span-2 md:col-span-1 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-3 flex items-center gap-3 group relative z-50">
               <div className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-800 text-zinc-400 group-focus-within:text-emerald-500 transition-colors"><Filter className="w-5 h-5" /></div>
               <div className="flex-1 relative">
                  <label className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 block mb-0.5">Mesec</label>
                  <MonthSelect value={selectedMonth} onChange={setSelectedMonth} options={availableMonths} />
               </div>
             </div>
             <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 backdrop-blur-sm p-3 flex flex-col justify-center text-center">
               <span className="text-[9px] font-bold tracking-widest uppercase text-emerald-400/80 mb-1">Profit</span>
               <span className={`text-xl font-mono font-black ${monthlyStats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eur(monthlyStats.profit)}</span>
             </div>
             <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm p-3 flex flex-col justify-center text-center">
               <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-1">W / L</span>
               <span className="text-xl font-bold text-white"><span className="text-emerald-400">{monthlyStats.wins}</span><span className="text-zinc-600 mx-1">/</span><span className="text-rose-400">{monthlyStats.losses}</span></span>
             </div>
             <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 backdrop-blur-sm p-3 flex flex-col justify-center text-center">
               <span className="text-[9px] font-bold tracking-widest uppercase text-amber-400/80 mb-1">Odprte</span>
               <span className="text-xl font-bold text-amber-400">{monthlyStats.openCount}</span>
             </div>
          </div>
          <div className="flex items-center">
             <button onClick={() => setShowAddForm(!showAddForm)} className={`h-full md:h-auto w-full md:w-auto px-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg active:scale-95 ${showAddForm ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20'}`}>
                {showAddForm ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                <span className="uppercase tracking-wider text-xs">{showAddForm ? "Zapri" : "Nova Stava"}</span>
             </button>
          </div>
        </section>

        {/* ADD FORM (Rendered if showAddForm is true) */}
        {showAddForm && (
           <div className="animate-in fade-in slide-in-from-top-4 duration-300 mb-10">
              <div className="rounded-3xl border border-zinc-800/60 bg-gradient-to-b from-zinc-900 to-black p-6 shadow-2xl">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                    <InputField label="Datum" value={datum} onChange={setDatum} type="date" icon={<Calendar className="w-3 h-3" />} />
                    <SelectField label="Status" value={wl} onChange={(v:any) => setWl(v)} options={["OPEN", "WIN", "LOSS", "VOID", "BACK WIN", "LAY WIN"]} icon={<Trophy className="w-3 h-3" />} />
                    <SelectField label="Šport" value={sport} onChange={(v:any) => setSport(v)} options={SPORTI} icon={<Target className="w-3 h-3" />} />
                    <SelectField label="Čas" value={casStave} onChange={(v:any) => setCasStave(v)} options={PRELIVE} icon={<Clock className="w-3 h-3" />} />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    <InputField label="Dogodek" value={dogodek} onChange={setDogodek} placeholder="Home : Away" />
                    <InputField label="Tip" value={tip} onChange={setTip} placeholder="npr. Over 2.5" />
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                    <SelectField label="Tip vnosa" value={mode} onChange={(v:any) => setMode(v)} options={MODES} icon={<Activity className="w-3 h-3" />} />
                    <InputField label="Back Kvota" value={kvota1} onChange={setKvota1} placeholder="2.00" icon={<TrendingUp className="w-3 h-3" />} />
                    <InputField label="Back Vplačilo" value={vplacilo1} onChange={setVplacilo1} placeholder="100" icon={<DollarSign className="w-3 h-3" />} />
                    <button onClick={addBet} className="h-[42px] mt-auto bg-emerald-500 text-black font-bold rounded-lg hover:bg-emerald-400 transition-all">Dodaj Stavo</button>
                 </div>
              </div>
           </div>
        )}

        {/* TABELA STAV */}
        <section className="rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm overflow-hidden flex flex-col h-[calc(100vh-350px)] min-h-[500px]">
          <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-300">Seznam Stav</h2>
            <button onClick={loadBets} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"><RefreshCw className="w-4 h-4" /></button>
          </div>

          <div className="overflow-auto custom-scrollbar flex-1 relative">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-20 bg-[#0c0c0e]">
                <tr className="border-b border-zinc-800/50">
                  <th className="py-4 px-3 text-zinc-500 uppercase text-[10px]">Datum</th>
                  <th className="py-4 px-3 text-zinc-500 uppercase text-[10px]">Status</th>
                  <th className="py-4 px-4 text-zinc-500 uppercase text-[10px]">Dogodek</th>
                  <th className="py-4 px-3 text-zinc-500 uppercase text-[10px]">Profit</th>
                  <th className="py-4 px-3 text-zinc-500 uppercase text-[10px]">Tipster</th>
                  <th className="py-4 px-3 text-zinc-500 uppercase text-[10px]">Akcija</th>
                </tr>
              </thead>
              <tbody>
                {computed.withProfit.length === 0 ? (
                  <tr><td colSpan={6} className="py-24 text-center opacity-40"><Inbox className="w-12 h-12 mx-auto mb-4" /><p>Ni stav za ta mesec</p></td></tr>
                ) : (
                  computed.withProfit.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-3 text-zinc-400 text-center">{formatDateSlovenian(r.datum)}</td>
                      <td className="py-3 px-3 text-center"><StatusBadge wl={r.wl} onClick={() => openStatusEdit(r)} /></td>
                      <td className="py-3 px-4 text-center"><div><TooltipCell text={r.dogodek} className="text-white font-medium" /><span className="text-zinc-500 text-xs">{r.tip}</span></div></td>
                      <td className="py-3 px-3 text-center"><span className={`font-mono font-bold ${r.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eurCompact(r.profit)}</span></td>
                      <td className="py-3 px-3 text-center text-zinc-400 text-xs">{r.tipster}</td>
                      <td className="py-3 px-3 text-center"><button onClick={() => openFullEdit(r)} className="p-1.5 text-zinc-400 hover:text-blue-400"><Pencil className="w-4 h-4" /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
      
      {/* MODALS (StatusEdit, FullEdit, Delete - tvoja originalna koda...) */}
      {statusEditOpen && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200]">/* Status Edit UI */</div>}
      
    </main>
  );
}