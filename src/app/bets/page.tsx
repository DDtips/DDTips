"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
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

function hasBack(b: BetRow): boolean {
  return (b.kvota1 ?? 0) > 1 && (b.vplacilo1 ?? 0) > 0;
}

function hasLay(b: BetRow): boolean {
  return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0;
}

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
  }
  else if (!hasBack(b) && hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "LAY WIN") brutoProfit = layStake;
    else if (b.wl === "LOSS" || b.wl === "BACK WIN") brutoProfit = -layLiability;
  }
  else if (hasBack(b) && !hasLay(b)) {
    if (b.wl === "WIN" || b.wl === "BACK WIN") brutoProfit = backStake * (backOdds - 1);
    else if (b.wl === "LOSS" || b.wl === "LAY WIN") brutoProfit = -backStake;
  }

  if (brutoProfit > 0) {
    return brutoProfit - komZnesek;
  }
  return brutoProfit;
}

// --- FUNKCIJA ZA EMOJI ŠPORTA ---
function getSportEmoji(sport: string): string {
  const sportEmojis: Record<string, string> = {
    "NOGOMET": "⚽",
    "TENIS": "🎾",
    "KOŠARKA": "🏀",
    "SM. SKOKI": "🎿",
    "SMUČANJE": "⛷️",
    "BIATLON": "🎯",
    "OSTALO": "🏅"
  };
  return sportEmojis[sport] || "🏅";
}

// --- FUNKCIJA ZA EMOJI ŠTEVILKE ---
function getNumberEmojis(num: number): string {
  const digitEmojis: Record<string, string> = {
    "0": "0️⃣", "1": "1️⃣", "2": "2️⃣", "3": "3️⃣", "4": "4️⃣",
    "5": "5️⃣", "6": "6️⃣", "7": "7️⃣", "8": "8️⃣", "9": "9️⃣"
  };
  return num.toString().split("").map(d => digitEmojis[d] || d).join("");
}

// --- TELEGRAM HELPER FUNKCIJA ---
function sendTelegramNotification(bet: BetRow, allBets: BetRow[]) {
  const vplacilo = bet.vplacilo1 || bet.vplacilo2 || 0;
  const kvota = bet.kvota1 || bet.lay_kvota || 0;
  const sportEmoji = getSportEmoji(bet.sport);
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  
  const statusEmoji = bet.cas_stave === "LIVE" ? "🔴" : "⏰";
  const statusText = bet.cas_stave === "LIVE" ? "Live" : "Prematch";
  
  const betMode: Mode = (bet.mode as Mode) || (hasBack(bet) && hasLay(bet) ? "TRADING" : "BET");
  const modeEmoji = betMode === "TRADING" ? "🔄" : "🎰";
  const modeText = betMode === "TRADING" ? "Trading" : "Betting";
  
  let msg = "";

  if (bet.wl === "OPEN") {
    msg = `📝 <b>DODANA NOVA STAVA</b>

${sportEmoji} <b>${bet.sport}</b>
━━━━━━━━━━━━━━━
🆚 ${bet.dogodek}
🎯 <b>${bet.tip}</b>

${statusEmoji} Status: <b>${statusText}</b>
${modeEmoji} Tip: <b>${modeText}</b>
📊 Kvota: <b>${kvota}</b>
💶 Vplačilo: <b>${vplacilo}€</b>${betMode === "TRADING" ? `
🔻 Lay: <b>${bet.lay_kvota}</b> │ 💸 <b>${bet.vplacilo2}€</b>` : ""}
━━━━━━━━━━━━━━━
🏦 ${bet.stavnica} │ 👤 ${bet.tipster}`;

  } else if (["WIN", "BACK WIN", "LAY WIN"].includes(bet.wl)) {
    const profit = calcProfit(bet);
    const todayBets = allBets.filter((r) => r.datum === bet.datum && r.wl !== "OPEN" && r.wl !== "VOID");
    const dailyProfit = todayBets.reduce((sum, r) => sum + calcProfit(r), 0);
    const profitSign = profit >= 0 ? "+" : "";
    const dailySign = dailyProfit >= 0 ? "+" : "";
    const profitEmoji = profit >= 0 ? "🟢" : "🔴";
    const dailyEmoji = dailyProfit >= 0 ? "📈" : "📉";
    
    const resultText = bet.wl === "BACK WIN" ? " (Back Win)" : bet.wl === "LAY WIN" ? " (Lay Win)" : "";
    
    msg = `✅🎉 <b>ZMAGA!</b>${resultText} 🎉✅

${sportEmoji} <b>${bet.sport}</b>
━━━━━━━━━━━━━━━
🆚 ${bet.dogodek}
🎯 <b>${bet.tip}</b>

${modeEmoji} Tip: <b>${modeText}</b>
📊 Back: <b>${bet.kvota1 > 0 ? bet.kvota1 : "-"}</b> │ 💶 <b>${bet.vplacilo1 > 0 ? bet.vplacilo1 + "€" : "-"}</b>${betMode === "TRADING" ? `
🔻 Lay: <b>${bet.lay_kvota}</b> │ 💸 <b>${bet.vplacilo2}€</b>` : ""}
🏦 ${bet.stavnica} │ 👤 ${bet.tipster}
━━━━━━━━━━━━━━━
💰 Profit: ${profitEmoji} <b>${profitSign}${eurCompact(profit)}</b>
${dailyEmoji} Danes (${day}.${month}.): <b>${dailySign}${eurCompact(dailyProfit)}</b>`;

  } else if (bet.wl === "LOSS") {
    const profit = calcProfit(bet);
    const todayBets = allBets.filter((r) => r.datum === bet.datum && r.wl !== "OPEN" && r.wl !== "VOID");
    const dailyProfit = todayBets.reduce((sum, r) => sum + calcProfit(r), 0);
    const profitSign = profit >= 0 ? "+" : "";
    const dailySign = dailyProfit >= 0 ? "+" : "";
    const profitEmoji = profit >= 0 ? "🟢" : "🔴";
    const dailyEmoji = dailyProfit >= 0 ? "📈" : "📉";
    
    msg = `❌ <b>PORAZ</b> ❌

${sportEmoji} <b>${bet.sport}</b>
━━━━━━━━━━━━━━━
🆚 ${bet.dogodek}
🎯 <b>${bet.tip}</b>

${modeEmoji} Tip: <b>${modeText}</b>
📊 Back: <b>${bet.kvota1 > 0 ? bet.kvota1 : "-"}</b> │ 💶 <b>${bet.vplacilo1 > 0 ? bet.vplacilo1 + "€" : "-"}</b>${betMode === "TRADING" ? `
🔻 Lay: <b>${bet.lay_kvota}</b> │ 💸 <b>${bet.vplacilo2}€</b>` : ""}
🏦 ${bet.stavnica} │ 👤 ${bet.tipster}
━━━━━━━━━━━━━━━
💸 Izguba: ${profitEmoji} <b>${profitSign}${eurCompact(profit)}</b>
${dailyEmoji} Danes (${day}.${month}.): <b>${dailySign}${eurCompact(dailyProfit)}</b>`;

  } else if (bet.wl === "VOID") {
    msg = `⚠️ <b>VOID - STAVA RAZVELJAVLJENA</b> ⚠️

${sportEmoji} <b>${bet.sport}</b>
━━━━━━━━━━━━━━━
🆚 ${bet.dogodek}
🎯 <b>${bet.tip}</b>
━━━━━━━━━━━━━━━
🏦 ${bet.stavnica} │ 👤 ${bet.tipster}

💵 Vračilo: <b>${vplacilo}€</b>`;
  }

  if (msg) {
    fetch("/api/send-telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
  }
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// --- KOMPONENTE UI ---

function MonthSelect({ value, onChange, options }: { value: string; onChange: (val: string) => void; options: string[]; }) {
  const [isOpen, setIsOpen] = useState(false);
  const getLabel = (m: string) => new Date(m + "-01").toLocaleDateString("sl-SI", { year: "numeric", month: "long" });

  return (
    <div className="relative w-full">
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all duration-200 capitalize glass-input ${isOpen ? "border-emerald-500/50 text-white" : "border-white/10 text-zinc-300 hover:border-white/20 hover:text-white"}`}>
        <span>{getLabel(value)}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-emerald-500" : ""}`} />
      </button>
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 glass-dropdown rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar py-1">
            {options.map((month) => (
              <button key={month} onClick={() => { onChange(month); setIsOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors capitalize border-l-2 ${month === value ? "bg-emerald-500/10 text-emerald-400 border-emerald-500" : "text-zinc-400 hover:bg-white/5 hover:text-white border-transparent"}`}>{getLabel(month)}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text", icon, inputMode, pattern, step }: any) {
  return (
    <div className="space-y-1.5 group">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon}{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} pattern={pattern} step={step} className="glass-input w-full px-3 py-2.5 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all duration-200" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, icon }: any) {
  return (
    <div className="space-y-1.5 group">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-zinc-500 group-focus-within:text-emerald-500 transition-colors">{icon}{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="glass-input w-full px-3 py-2.5 rounded-lg text-white text-sm appearance-none focus:outline-none focus:border-emerald-500/50 transition-all duration-200 cursor-pointer pr-8">
          {options.map((opt: string) => <option key={opt} value={opt} className="bg-zinc-900 text-white">{opt}</option>)}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500"><ChevronDown className="w-4 h-4" /></div>
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
    "BACK WIN": "bg-emerald-600/20 text-emerald-400 border-emerald-500/50 font-black",
    "LAY WIN": "bg-pink-600/20 text-pink-400 border-pink-500/50 font-black"
  } as const;
  return <button onClick={onClick} className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${styles[wl] || styles.OPEN} transition-all duration-300 hover:brightness-125 cursor-pointer uppercase`}>{wl}</button>;
}

function TooltipCell({ text, className = "" }: { text: string; className?: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <span className={`block truncate cursor-default ${className}`}>{text}</span>
      {showTooltip && text.length > 12 && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 glass-tooltip whitespace-nowrap">
          <span className="text-sm text-white">{text}</span>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800"></div>
        </div>
      )}
    </div>
  );
}

// --- GLAVNA STRAN ---

export default function BetsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [mounted, setMounted] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [betToDelete, setBetToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [wl, setWl] = useState<WL>("OPEN");
  const [sport, setSport] = useState<string>("NOGOMET");
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
  const [tipster, setTipster] = useState<string>("DAVID");
  const [stavnica, setStavnica] = useState<string>("SHARP");

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
    setMounted(true);
    const checkAccess = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('is_approved').eq('id', user.id).single();
      if (user.email !== "skolnik.dejan40@gmail.com" && (!profile || !profile.is_approved)) { router.replace("/pending"); return; }
      setUser(user);
      await loadBets();
      setLoading(false);
    };
    checkAccess();
  }, [router]);

  useEffect(() => {
    if (mode === "TRADING") return;
    if (betSide === "BACK") { setLayKvota(""); setVplacilo2(""); } else { setKvota1(""); setVplacilo1(""); }
  }, [mode, betSide]);

  async function loadBets() {
    const { data, error } = await supabase.from("bets").select("*").order("datum", { ascending: false }).order("created_at", { ascending: false });
    if (error) { setMsg(error.message); return; }
    setRows((data || []) as BetRow[]);
  }

  function resetForm() {
    setWl("OPEN"); setDogodek(""); setTip(""); setMode("BET"); setBetSide("BACK"); setKvota1(""); setVplacilo1(""); setLayKvota(""); setVplacilo2(""); setKomisija("0");
  }

  async function addBet() {
    const payload = {
      datum, wl, dogodek, tip, sport, cas_stave: casStave, tipster, stavnica, mode,
      kvota1: parseNum(kvota1), vplacilo1: parseNum(vplacilo1),
      lay_kvota: parseNum(layKvota), vplacilo2: parseNum(vplacilo2), komisija: parseNum(komisija),
      created_by: user?.id
    };
    const { data, error } = await supabase.from("bets").insert([payload]).select().single();
    if (error) { toast.error(error.message); return; }
    try {
      const newBet = data as BetRow;
      const updatedRows = [newBet, ...rows];
      setRows(updatedRows);
      sendTelegramNotification(newBet, updatedRows);
    } catch (err) { console.error("Telegram error:", err); }
    window.dispatchEvent(new Event("bets-updated"));
    toast.success("Stava uspešno dodana!");
    setShowAddForm(false);
    resetForm();
  }

  function openDeleteModal(id: string) { setBetToDelete(id); setIsDeleteModalOpen(true); }

  async function confirmDelete() {
    if (!betToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("bets").delete().eq("id", betToDelete);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== betToDelete));
      if (fullEditOpen && editingBet?.id === betToDelete) { setFullEditOpen(false); setEditingBet(null); }
      window.dispatchEvent(new Event("bets-updated"));
      toast.success("Stava uspešno izbrisana");
      setIsDeleteModalOpen(false);
      setBetToDelete(null);
    } catch (error: any) { toast.error("Napaka pri brisanju: " + error.message);
    } finally { setDeleting(false); }
  }

  function openStatusEdit(b: BetRow) { setStatusEditId(b.id); setStatusEditWl(b.wl); setStatusEditOpen(true); }
  function openFullEdit(b: BetRow) {
    setEditingBet({ ...b });
    setEditKvota1(b.kvota1?.toString() ?? "");
    setEditVplacilo1(b.vplacilo1?.toString() ?? "");
    setEditLayKvota(b.lay_kvota?.toString() ?? "");
    setEditVplacilo2(b.vplacilo2?.toString() ?? "");
    setEditKomisija(b.komisija?.toString() ?? "0");
    setFullEditOpen(true);
  }

  async function saveStatusEdit() {
    if (!statusEditId) return;
    const { error } = await supabase.from("bets").update({ wl: statusEditWl }).eq("id", statusEditId);
    if (error) { setMsg(error.message); return; }
    const oldBet = rows.find(r => r.id === statusEditId);
    if (oldBet) {
      const updatedBet = { ...oldBet, wl: statusEditWl };
      const updatedRows = rows.map((r) => (r.id === statusEditId ? updatedBet : r));
      setRows(updatedRows);
      sendTelegramNotification(updatedBet, updatedRows);
    }
    setStatusEditOpen(false);
    setStatusEditId(null);
    window.dispatchEvent(new Event("bets-updated"));
    toast.success("Status posodobljen");
  }

  async function saveFullEdit() {
    if (!editingBet) return;
    const updatedBet: BetRow = {
      ...editingBet,
      kvota1: parseNum(editKvota1), vplacilo1: parseNum(editVplacilo1),
      lay_kvota: parseNum(editLayKvota), vplacilo2: parseNum(editVplacilo2), komisija: parseNum(editKomisija)
    };
    const oldStatus = rows.find(r => r.id === updatedBet.id)?.wl || "OPEN";
    const { error } = await supabase.from("bets").update({
      datum: updatedBet.datum, wl: updatedBet.wl, dogodek: updatedBet.dogodek, tip: updatedBet.tip,
      sport: updatedBet.sport, cas_stave: updatedBet.cas_stave, tipster: updatedBet.tipster, stavnica: updatedBet.stavnica,
      mode: updatedBet.mode, kvota1: updatedBet.kvota1, vplacilo1: updatedBet.vplacilo1,
      lay_kvota: updatedBet.lay_kvota, vplacilo2: updatedBet.vplacilo2, komisija: updatedBet.komisija
    }).eq("id", updatedBet.id);
    if (error) { alert("Napaka pri shranjevanju: " + error.message); return; }
    setRows((prev) => prev.map((r) => (r.id === updatedBet.id ? updatedBet : r)));
    if (oldStatus !== updatedBet.wl) {
      try {
        const updatedRows = rows.map((r) => (r.id === updatedBet.id ? updatedBet : r));
        sendTelegramNotification(updatedBet, updatedRows);
      } catch (err) { console.error("Telegram error:", err); }
    }
    setFullEditOpen(false);
    setEditingBet(null);
    window.dispatchEvent(new Event("bets-updated"));
    toast.success("Stava posodobljena");
  }

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((r) => r.datum.startsWith(selectedMonth));
    return filtered.sort((a, b) => {
      if (b.datum > a.datum) return 1;
      if (b.datum < a.datum) return -1;
      const tA = a.created_at || "";
      const tB = b.created_at || "";
      return tB > tA ? 1 : tB < tA ? -1 : 0;
    });
  }, [rows, selectedMonth]);

  const computed = useMemo(() => ({ withProfit: filteredRows.map((r) => ({ ...r, profit: calcProfit(r) })) }), [filteredRows]);
  const availableMonths = useMemo(() => {
    const months = new Set(rows.map((r) => r.datum.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [rows]);

  const monthlyStats = useMemo(() => {
    const settled = computed.withProfit.filter((r) => r.wl !== "OPEN" && r.wl !== "VOID");
    const profit = settled.reduce((acc, r) => acc + r.profit, 0);
    const wins = settled.filter((r) => ["WIN", "BACK WIN", "LAY WIN"].includes(r.wl)).length;
    const losses = settled.filter((r) => r.wl === "LOSS").length;
    const openCount = computed.withProfit.filter((r) => r.wl === "OPEN").length;
    return { profit, wins, losses, openCount };
  }, [computed.withProfit]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4 text-center p-6">
      <Loader2 className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">Preverjanje dostopa...</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />
      
      {/* Decorative Blurs */}
      <div className="fixed top-[-10%] left-[-5%] w-[400px] h-[400px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none" />

      <style jsx global>{`
        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        /* Glass Card Base Style */
        .glass-card {
          position: relative;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.08) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 25px 50px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 20px;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          overflow: hidden;
        }

        .glass-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.05),
            transparent
          );
          transition: 0.6s;
          pointer-events: none;
        }

        .glass-card:hover {
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 
            0 30px 60px rgba(0, 0, 0, 0.3),
            0 0 40px var(--glow-color, rgba(16, 185, 129, 0.1)),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          transform: translateY(-2px);
        }

        .glass-card:hover::before {
          left: 100%;
        }

        /* Glass Input */
        .glass-input {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .glass-input:focus {
          border-color: rgba(16, 185, 129, 0.5);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.15);
        }

        /* Glass Dropdown */
        .glass-dropdown {
          background: linear-gradient(
            135deg,
            rgba(9, 9, 11, 0.95) 0%,
            rgba(9, 9, 11, 0.9) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        /* Glass Tooltip */
        .glass-tooltip {
          background: linear-gradient(
            135deg,
            rgba(0, 0, 0, 0.9) 0%,
            rgba(0, 0, 0, 0.8) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 12px;
        }

        /* Glass Table */
        .glass-table {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.06) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 
            0 25px 50px rgba(0, 0, 0, 0.2),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 24px;
        }

        /* Glass Modal */
        .glass-modal {
          background: linear-gradient(
            135deg,
            rgba(9, 9, 11, 0.98) 0%,
            rgba(9, 9, 11, 0.95) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 25px 50px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        /* Glass Form */
        .glass-form {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.04) 0%,
            rgba(255, 255, 255, 0.01) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        /* Glass Button */
        .glass-button {
          background: linear-gradient(
            135deg,
            rgba(16, 185, 129, 0.9) 0%,
            rgba(16, 185, 129, 0.7) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 
            0 15px 35px rgba(16, 185, 129, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .glass-button:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 20px 40px rgba(16, 185, 129, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.2) inset;
        }
      `}</style>

      <div className="relative max-w-[1800px] mx-auto px-4 md:px-6 pt-48 pb-12">
        {/* Stats Cards Section */}
        <section className="mb-8 flex flex-col md:flex-row items-stretch gap-4 justify-between">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            {/* Month Filter Card */}
            <div className="col-span-2 md:col-span-1 glass-card p-3 flex items-center gap-3 group relative z-50">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 text-zinc-400 group-focus-within:text-emerald-500 transition-colors">
                <Filter className="w-5 h-5" />
              </div>
              <div className="flex-1 relative">
                <label className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 block mb-0.5">Mesec</label>
                <MonthSelect value={selectedMonth} onChange={setSelectedMonth} options={availableMonths} />
              </div>
            </div>
            
            {/* Profit Card */}
            <div className="glass-card p-3 flex flex-col justify-center text-center" style={{ "--glow-color": monthlyStats.profit >= 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)" } as React.CSSProperties}>
              <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-400 mb-1">Profit</span>
              <span className={`text-xl font-mono font-black ${monthlyStats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{eur(monthlyStats.profit)}</span>
            </div>
            
            {/* W/L Card */}
            <div className="glass-card p-3 flex flex-col justify-center text-center">
              <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-1">W / L</span>
              <span className="text-xl font-bold text-white">
                <span className="text-emerald-400">{monthlyStats.wins}</span>
                <span className="text-zinc-600 mx-1">/</span>
                <span className="text-rose-400">{monthlyStats.losses}</span>
              </span>
            </div>
            
            {/* Open Bets Card */}
            <div className="glass-card p-3 flex flex-col justify-center text-center" style={{ "--glow-color": "rgba(245, 158, 11, 0.15)" } as React.CSSProperties}>
              <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-400 mb-1">Odprte</span>
              <span className="text-xl font-bold text-amber-400">{monthlyStats.openCount}</span>
            </div>
          </div>
          
          {/* Add New Bet Button */}
          <div className="flex items-center">
            <button 
              onClick={() => setShowAddForm(!showAddForm)} 
              className={`h-full md:h-auto w-full md:w-auto px-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg active:scale-95 ${
                showAddForm 
                  ? 'glass-card text-zinc-300' 
                  : 'glass-button text-black'
              }`}
            >
              {showAddForm ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              <span className="uppercase tracking-wider text-xs">{showAddForm ? "Zapri" : "Nova Stava"}</span>
            </button>
          </div>
        </section>

        {msg && <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm text-center backdrop-blur-sm">{msg}</div>}

        {/* Add Form */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showAddForm ? 'max-h-[800px] opacity-100 mb-10' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="glass-card p-1">
            <div className="glass-form rounded-[18px] p-6">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Plus className="w-4 h-4 text-emerald-500" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-300">Vnos Stave</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <InputField label="Datum" value={datum} onChange={setDatum} type="date" icon={<Calendar className="w-3 h-3" />} />
                <div className="space-y-1.5">
                  <SelectField label="Status" value={wl} onChange={(v: any) => setWl(v)} options={["OPEN", "WIN", "LOSS", "VOID", "BACK WIN", "LAY WIN"]} icon={<Trophy className="w-3 h-3" />} />
                  {mode === "TRADING" && (
                    <div className="flex gap-1">
                      <button onClick={() => setWl("BACK WIN")} className={`flex-1 py-1 rounded border text-[9px] font-black transition-all ${wl === "BACK WIN" ? "bg-emerald-500 text-black border-emerald-400" : "glass-input text-zinc-500"}`}>BACK WIN</button>
                      <button onClick={() => setWl("LAY WIN")} className={`flex-1 py-1 rounded border text-[9px] font-black transition-all ${wl === "LAY WIN" ? "bg-pink-500 text-black border-pink-400" : "glass-input text-zinc-500"}`}>LAY WIN</button>
                    </div>
                  )}
                </div>
                <SelectField label="Šport" value={sport} onChange={(v: any) => setSport(v)} options={SPORTI} icon={<Target className="w-3 h-3" />} />
                <SelectField label="Čas" value={casStave} onChange={(v: any) => setCasStave(v)} options={PRELIVE} icon={<Clock className="w-3 h-3" />} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <InputField label="Dogodek" value={dogodek} onChange={setDogodek} placeholder="Home : Away" />
                <InputField label="Tip" value={tip} onChange={setTip} placeholder="npr. Over 2.5" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <SelectField label="Tip vnosa" value={mode} onChange={(v: any) => setMode(v)} options={MODES} icon={<Activity className="w-3 h-3" />} />
                {mode === "BET" ? (
                  <SelectField label="Stava" value={betSide} onChange={(v: any) => setBetSide(v)} options={BET_SIDES} icon={<Target className="w-3 h-3" />} />
                ) : <div className="hidden md:block" />}
                <InputField label="Komisija" value={komisija} onChange={setKomisija} placeholder="0" icon={<Percent className="w-3 h-3" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                <div className="hidden md:block" />
              </div>
              {(mode === "TRADING" || (mode === "BET" && betSide === "BACK")) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 p-4 rounded-xl glass-form">
                  <InputField label="Back Kvota" value={kvota1} onChange={setKvota1} placeholder="2.00" icon={<TrendingUp className="w-3 h-3 text-emerald-500" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                  <InputField label="Back Vplačilo" value={vplacilo1} onChange={setVplacilo1} placeholder="100" icon={<DollarSign className="w-3 h-3 text-emerald-500" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                  {mode === "TRADING" ? (
                    <>
                      <InputField label="Lay Kvota" value={layKvota} onChange={setLayKvota} placeholder="2.00" icon={<TrendingUp className="w-3 h-3 text-rose-500" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                      <InputField label="Lay Liability" value={vplacilo2} onChange={setVplacilo2} placeholder="100" icon={<DollarSign className="w-3 h-3 text-rose-500" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                    </>
                  ) : <><div className="hidden md:block" /><div className="hidden md:block" /></>}
                </div>
              )}
              {mode === "BET" && betSide === "LAY" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 p-4 rounded-xl glass-form">
                  <InputField label="Lay Kvota" value={layKvota} onChange={setLayKvota} placeholder="2.00" icon={<TrendingUp className="w-3 h-3 text-rose-500" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                  <InputField label="Lay Liability" value={vplacilo2} onChange={setVplacilo2} placeholder="100" icon={<DollarSign className="w-3 h-3 text-rose-500" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                  <div className="hidden md:block" /><div className="hidden md:block" />
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <SelectField label="Tipster" value={tipster} onChange={(v: any) => setTipster(v)} options={TIPSTERJI} icon={<Users className="w-3 h-3" />} />
                <SelectField label="Stavnica" value={stavnica} onChange={(v: any) => setStavnica(v)} options={STAVNICE} icon={<Building2 className="w-3 h-3" />} />
                <div className="hidden md:block" />
                <button onClick={addBet} className="glass-button w-full h-[42px] flex items-center justify-center gap-2 text-black text-sm font-bold rounded-lg active:scale-[0.98]">
                  <Plus className="w-4 h-4" /> Dodaj Stavo
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bets Table */}
        <section className="glass-table overflow-hidden relative z-0 flex flex-col h-[calc(100vh-350px)] min-h-[500px]">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-300">Seznam Stav</h2>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => loadBets()} className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 transition-colors border border-white/10" title="Ročno osveži podatke">
                <RefreshCw className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-bold text-zinc-500 bg-white/5 border border-white/10 px-2 py-1 rounded-md">{computed.withProfit.length}</span>
            </div>
          </div>

          <div className="overflow-auto custom-scrollbar flex-1 relative">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr className="bg-black/80 backdrop-blur-sm">
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Datum</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Status</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Mode</th>
                  <th className="text-center py-4 px-4 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5" style={{ minWidth: "180px" }}>Dogodek</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Back</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Vplač.</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Lay</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Liability</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Kom.</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Profit</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Tipster / Šport</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Stavnica</th>
                  <th className="text-center py-4 px-3 font-bold tracking-wider uppercase text-zinc-500 border-b border-white/5">Akcija</th>
                </tr>
              </thead>
              <tbody>
                {computed.withProfit.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center opacity-40">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                          <Inbox className="w-8 h-8 text-zinc-500" />
                        </div>
                        <h3 className="text-zinc-300 font-bold text-lg mb-1">Ni podatkov za ta mesec</h3>
                        <p className="text-zinc-500 text-xs uppercase tracking-wider mb-6">V tem obdobju še ni vpisane nobene stave.</p>
                        <button onClick={() => setShowAddForm(true)} className="px-5 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all">
                          + Dodaj prvo stavo
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  computed.withProfit.map((r, idx) => {
                    const rowMode: Mode = (r.mode as Mode) || (hasBack(r) && hasLay(r) ? "TRADING" : "BET");
                    return (
                      <tr key={r.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors group ${idx % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent"}`}>
                        <td className="py-3 px-3 text-zinc-400 text-center whitespace-nowrap border-b border-white/5">{formatDateSlovenian(r.datum)}</td>
                        <td className="py-3 px-3 text-center border-b border-white/5"><StatusBadge wl={r.wl} onClick={() => openStatusEdit(r)} /></td>
                        <td className="py-3 px-3 text-center border-b border-white/5"><span className={`px-2 py-0.5 rounded text-xs font-bold border ${rowMode === "TRADING" ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-sky-500/10 text-sky-400 border-sky-500/20"}`}>{rowMode}</span></td>
                        <td className="py-3 px-4 text-center border-b border-white/5"><div className="space-y-0.5"><TooltipCell text={r.dogodek} className="text-white font-medium" /><TooltipCell text={r.tip} className="text-zinc-500 text-xs" /></div></td>
                        <td className="py-3 px-3 text-center border-b border-white/5"><span className="text-zinc-300 font-medium font-mono tracking-tight">{r.kvota1 > 0 ? r.kvota1.toFixed(2) : "-"}</span></td>
                        <td className="py-3 px-3 text-center border-b border-white/5"><span className="text-zinc-400 font-mono tracking-tight">{r.vplacilo1 > 0 ? eurCompact(r.vplacilo1) : "-"}</span></td>
                        <td className="py-3 px-3 text-center border-b border-white/5"><span className="text-rose-300 font-medium font-mono tracking-tight">{(r.lay_kvota ?? 0) > 0 ? (r.lay_kvota ?? 0).toFixed(2) : "-"}</span></td>
                        <td className="py-3 px-3 text-center border-b border-white/5"><span className="text-zinc-400 font-mono tracking-tight">{(r.vplacilo2 ?? 0) > 0 ? eurCompact(r.vplacilo2 ?? 0) : "-"}</span></td>
                        <td className="py-3 px-3 text-center border-b border-white/5"><span className="text-zinc-500 font-mono tracking-tight">{(r.komisija ?? 0) > 0 ? eurCompact(r.komisija ?? 0) : "-"}</span></td>
                        <td className="py-3 px-3 text-center border-b border-white/5">
                          <div className={`inline-flex items-center justify-center px-2 py-1 rounded-md font-mono font-bold text-xs tracking-tight border min-w-[70px] ${
                            r.profit > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_-4px_rgba(16,185,129,0.3)]" :
                            r.profit < 0 ? "bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_10px_-4px_rgba(244,63,94,0.3)]" :
                            "bg-white/5 border-white/10 text-zinc-400"
                          }`}>
                            {eurCompact(r.profit)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center border-b border-white/5"><div className="flex flex-col items-center gap-1"><span className="text-xs px-1.5 py-0.5 bg-white/5 text-zinc-300 rounded border border-white/10">{r.tipster}</span><span className="text-xs px-1.5 py-0.5 bg-white/5 text-zinc-400 rounded border border-white/10">{r.sport}</span></div></td>
                        <td className="py-3 px-3 text-zinc-400 text-center text-xs border-b border-white/5">{r.stavnica}</td>
                        <td className="py-3 px-2 text-center border-b border-white/5">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openFullEdit(r)} className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-500/20 text-zinc-400 hover:text-blue-400 transition-colors border border-white/10"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => openDeleteModal(r.id)} className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors border border-white/10"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-12 pt-8 border-t border-white/5 text-center flex flex-col md:flex-row justify-between items-center text-zinc-500 text-xs gap-2">
          <p className="hover:text-zinc-300 transition-colors">© 2026 DDTips Analytics.</p>
          <p className="font-mono bg-white/5 px-3 py-1 rounded-full border border-white/10">Last sync: {mounted ? new Date().toLocaleTimeString() : "--:--:--"}</p>
        </footer>
      </div>

      {/* Status Edit Modal */}
      {statusEditOpen && (
        <div onClick={() => setStatusEditOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div onClick={(e) => e.stopPropagation()} className="glass-modal rounded-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Spremeni status</h3>
              <button onClick={() => setStatusEditOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <div className="mb-8">
              <label className="block text-xs font-bold tracking-widest uppercase text-zinc-500 mb-4 text-center">Izberi nov status</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => setStatusEditWl("BACK WIN")} className={`px-2 py-3 rounded-xl text-[10px] font-black border transition-all ${statusEditWl === "BACK WIN" ? "bg-emerald-500 text-black border-emerald-400" : "glass-input text-zinc-400 hover:bg-white/10"}`}>BACK WIN</button>
                <button onClick={() => setStatusEditWl("LAY WIN")} className={`px-2 py-3 rounded-xl text-[10px] font-black border transition-all ${statusEditWl === "LAY WIN" ? "bg-pink-500 text-black border-pink-400" : "glass-input text-zinc-400 hover:bg-white/10"}`}>LAY WIN</button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(["OPEN", "WIN", "LOSS", "VOID"] as WL[]).map((status) => (
                  <button key={status} onClick={() => setStatusEditWl(status)} className={`px-2 py-4 rounded-xl text-xs font-bold transition-all duration-300 border ${statusEditWl === status ? status === "WIN" ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]" : status === "LOSS" ? "bg-rose-500 text-white border-rose-400 shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)]" : status === "VOID" ? "bg-zinc-500 text-white border-zinc-400" : "bg-amber-500 text-white border-amber-400" : "glass-input text-zinc-400 hover:bg-white/10"}`}>{status}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStatusEditOpen(false)} className="flex-1 px-6 py-3 glass-input text-zinc-300 font-bold rounded-xl hover:bg-white/10 transition-all duration-300">Prekliči</button>
              <button onClick={saveStatusEdit} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all duration-300"><Check className="w-4 h-4" /> Potrdi</button>
            </div>
          </div>
        </div>
      )}

      {/* Full Edit Modal */}
      {fullEditOpen && editingBet && (
        <div onClick={() => setFullEditOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div onClick={(e) => e.stopPropagation()} className="glass-modal rounded-2xl p-6 max-w-4xl w-full animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Pencil className="w-5 h-5 text-emerald-500"/> Uredi podrobnosti stave</h3>
              <button onClick={() => setFullEditOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputField label="Datum" value={editingBet.datum} onChange={(v: string) => setEditingBet({...editingBet, datum: v})} type="date" icon={<Calendar className="w-3 h-3" />} />
                <SelectField label="Status" value={editingBet.wl} onChange={(v: any) => setEditingBet({...editingBet, wl: v})} options={["OPEN", "WIN", "LOSS", "VOID", "BACK WIN", "LAY WIN"]} icon={<Trophy className="w-3 h-3" />} />
                <SelectField label="Šport" value={editingBet.sport} onChange={(v: any) => setEditingBet({...editingBet, sport: v})} options={SPORTI} icon={<Target className="w-3 h-3" />} />
                <SelectField label="Čas" value={editingBet.cas_stave} onChange={(v: any) => setEditingBet({...editingBet, cas_stave: v})} options={PRELIVE} icon={<Clock className="w-3 h-3" />} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Dogodek" value={editingBet.dogodek} onChange={(v: string) => setEditingBet({...editingBet, dogodek: v})} />
                <InputField label="Tip" value={editingBet.tip} onChange={(v: string) => setEditingBet({...editingBet, tip: v})} />
              </div>
              <div className="p-4 rounded-xl glass-form">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <SelectField label="Tip vnosa" value={editingBet.mode || "BET"} onChange={(v: any) => setEditingBet({...editingBet, mode: v})} options={MODES} icon={<Activity className="w-3 h-3" />} />
                  <InputField label="Komisija" value={editKomisija} onChange={setEditKomisija} icon={<Percent className="w-3 h-3" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InputField label="Back Kvota" value={editKvota1} onChange={setEditKvota1} icon={<TrendingUp className="w-3 h-3 text-emerald-500" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                  <InputField label="Back Vplačilo" value={editVplacilo1} onChange={setEditVplacilo1} icon={<DollarSign className="w-3 h-3 text-emerald-500" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                  <InputField label="Lay Kvota" value={editLayKvota} onChange={setEditLayKvota} icon={<TrendingUp className="w-3 h-3 text-rose-500" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                  <InputField label="Lay Liability" value={editVplacilo2} onChange={setEditVplacilo2} icon={<DollarSign className="w-3 h-3 text-rose-500" />} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SelectField label="Tipster" value={editingBet.tipster} onChange={(v: any) => setEditingBet({...editingBet, tipster: v})} options={TIPSTERJI} icon={<Users className="w-3 h-3" />} />
                <SelectField label="Stavnica" value={editingBet.stavnica} onChange={(v: any) => setEditingBet({...editingBet, stavnica: v})} options={STAVNICE} icon={<Building2 className="w-3 h-3" />} />
              </div>
            </div>
            <div className="flex gap-3 mt-8 pt-4 border-t border-white/5">
              <button
                onClick={() => openDeleteModal(editingBet.id)}
                className="px-4 py-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold rounded-xl hover:bg-rose-500/20 transition-all flex items-center gap-2"
                title="Izbriši to stavo"
              >
                <Trash2 className="w-4 h-4" /> Izbriši
              </button>
              <div className="flex gap-3 ml-auto">
                <button onClick={() => setFullEditOpen(false)} className="px-6 py-2.5 glass-input text-zinc-300 font-bold rounded-xl hover:bg-white/10 transition-all">Prekliči</button>
                <button onClick={saveFullEdit} className="px-6 py-2.5 glass-button text-black font-bold rounded-xl flex items-center gap-2"><Save className="w-4 h-4" /> Shrani</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative w-full max-w-sm glass-modal rounded-2xl p-6 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-50" />
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Izbriši stavo?</h3>
                <p className="text-sm text-zinc-400">Ali ste prepričani, da želite izbrisati to stavo? Tega dejanja ni mogoče razveljaviti.</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2.5 rounded-xl glass-input text-zinc-400 text-xs font-bold uppercase tracking-wider hover:bg-white/10 hover:text-white transition-colors">Prekliči</button>
                <button onClick={confirmDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-rose-600/10 border border-rose-600/20 text-rose-500 text-xs font-bold uppercase tracking-wider hover:bg-rose-600 hover:text-white transition-all hover:shadow-[0_0_20px_-5px_rgba(225,29,72,0.4)] flex items-center justify-center gap-2">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? "Brisanje..." : "Izbriši"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}