"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  XCircle 
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  
  const [view, setView] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"error" | "success">("error");

  function cleanEmail(x: string) {
    return x.trim().toLowerCase();
  }

  function validate(): string | null {
    if (!cleanEmail(email)) return "Prosimo, vpišite veljaven email naslov.";
    if (!password) return "Prosimo, vpišite geslo.";
    if (password.length < 6) return "Geslo mora vsebovati vsaj 6 znakov.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const v = validate();
    if (v) {
      setMsg(v);
      setMsgType("error");
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      if (view === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail(email),
          password,
        });

        if (error) throw error;

        if (!data.session) {
          setMsg("Uspešno! Preverite email za potrditev računa.");
          setMsgType("success");
        } else {
          setMsg("Račun ustvarjen! Preusmerjanje...");
          setMsgType("success");
          setTimeout(() => router.replace("/"), 1000);
        }

      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail(email),
          password,
        });

        if (error) throw error;

        if (!data.session) {
          setMsg("Prijava ni uspela. Preverite podatke.");
          setMsgType("error");
        } else {
          setMsg("Dobrodošli nazaj!");
          setMsgType("success");
          setTimeout(() => router.replace("/"), 500);
        }
      }
    } catch (error: any) {
      console.error("AUTH ERROR:", error);
      setMsg(view === "login" ? "Napačen email ali geslo." : error.message);
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#0B1120] font-sans selection:bg-emerald-500/30">
      
      {/* --- Ozadje (Ambient Glow) --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
        {/* Noise texture overlay za "premium" občutek */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
      </div>

      {/* --- Kartica --- */}
      <div className="relative z-10 w-full max-w-[400px] p-6">
        <div className="overflow-hidden rounded-3xl border border-white/5 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
          
          {/* Header z LOGOTIPOM */}
          <div className="p-8 pb-6 text-center flex flex-col items-center">
            {/* LOGO - Nadomesti prejšnjo ikono */}
            <div className="mb-6 relative group">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>
              <img 
                src="/images/logo-full.png" // Preveri, da je pot pravilna!
                alt="DD Tips" 
                className="relative h-20 w-auto object-contain drop-shadow-2xl"
              />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white">
              Dobrodošli na DDTips
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Napredna analitika in športni nasveti.
            </p>
          </div>

          {/* Tabs (Preklopnik) */}
          <div className="px-8">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-950/50 p-1 border border-white/5">
              <button
                onClick={() => { setView("login"); setMsg(null); }}
                className={`relative flex items-center justify-center rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  view === "login" 
                    ? "bg-slate-800 text-white shadow-lg" 
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                }`}
              >
                Prijava
              </button>
              <button
                onClick={() => { setView("register"); setMsg(null); }}
                className={`relative flex items-center justify-center rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  view === "register" 
                    ? "bg-slate-800 text-white shadow-lg" 
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                }`}
              >
                Registracija
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="p-8 pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Email</label>
                <div className="group relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vas@email.com"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 transition-all focus:border-emerald-500/50 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Geslo</label>
                  {view === "login" && (
                    <button type="button" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-medium">
                      Pozabljeno?
                    </button>
                  )}
                </div>
                <div className="group relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 transition-all focus:border-emerald-500/50 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Status Message */}
              {msg && (
                <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                  msgType === "error" 
                    ? "border-red-500/20 bg-red-500/10 text-red-400" 
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                } animate-in fade-in zoom-in duration-200`}>
                  {msgType === "error" ? <XCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                  <p className="font-medium">{msg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-emerald-500 hover:shadow-emerald-500/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 mt-4"
              >
                {/* Shine effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
                
                <span className="relative z-10 flex items-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {!loading && (view === "login" ? "Prijava" : "Ustvari Račun")}
                  {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                </span>
              </button>
            </form>
          </div>

          {/* Footer area */}
          <div className="border-t border-white/5 bg-slate-950/30 p-5 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">
              Zaščiteno z <span className="text-slate-400 font-bold">Supabase Auth</span>
            </p>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="mt-8 text-center opacity-60 hover:opacity-100 transition-opacity">
          <p className="text-xs text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} DDTips Analytics.
          </p>
        </div>
      </div>
    </div>
  );
}