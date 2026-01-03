"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  TrendingUp, 
  CheckCircle2, 
  XCircle 
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  
  // State za način delovanja: 'login' ali 'register'
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

  // Enotna funkcija za obdelavo obrazca
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
        // --- LOGIKA REGISTRACIJE ---
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
        // --- LOGIKA PRIJAVE ---
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
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black font-sans selection:bg-emerald-500/30">
      
      {/* --- Ozadje --- */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-teal-900/20 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
      </div>

      {/* --- Kartica --- */}
      <div className="relative z-10 w-full max-w-[420px] p-6 sm:p-0">
        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl shadow-2xl ring-1 ring-white/10">
          
          {/* Header */}
          <div className="p-8 pb-6 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Dobrodošli na DDTips
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Napredna analitika in športni nasveti.
            </p>
          </div>

          {/* Tabs (Preklopnik) */}
          <div className="px-8">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-950/50 p-1">
              <button
                onClick={() => { setView("login"); setMsg(null); }}
                className={`flex items-center justify-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                  view === "login" 
                    ? "bg-zinc-800 text-white shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                Prijava
              </button>
              <button
                onClick={() => { setView("register"); setMsg(null); }}
                className={`flex items-center justify-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                  view === "register" 
                    ? "bg-zinc-800 text-white shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                Registracija
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="p-8 pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 ml-1">Email</label>
                <div className="group relative">
                  <div className="pointer-events-none absolute left-3 top-3.5 text-zinc-500 transition-colors group-focus-within:text-emerald-500">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vas@email.com"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 py-3 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 transition-all focus:border-emerald-500/50 focus:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-medium text-zinc-300">Geslo</label>
                  {view === "login" && (
                    <button type="button" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
                      Pozabljeno geslo?
                    </button>
                  )}
                </div>
                <div className="group relative">
                  <div className="pointer-events-none absolute left-3 top-3.5 text-zinc-500 transition-colors group-focus-within:text-emerald-500">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 py-3 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 transition-all focus:border-emerald-500/50 focus:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
              </div>

              {/* Status Message */}
              {msg && (
                <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                  msgType === "error" 
                    ? "border-red-500/20 bg-red-500/10 text-red-400" 
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                } animate-in fade-in slide-in-from-top-2 duration-300`}>
                  {msgType === "error" ? <XCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
                  <p>{msg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-emerald-500 hover:shadow-emerald-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 mt-2"
              >
                {/* Shine effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-0" />
                
                <span className="relative z-10 flex items-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {!loading && (view === "login" ? "Prijava" : "Ustvari račun")}
                  {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                </span>
              </button>
            </form>
          </div>

          {/* Footer area */}
          <div className="border-t border-zinc-800 bg-zinc-900/50 p-6 text-center">
            <p className="text-xs text-zinc-500">
              Z nadaljevanjem se strinjate s{' '}
              <a href="#" className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300">Pogoji uporabe</a>
              {' '}in{' '}
              <a href="#" className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300">Zasebnostjo</a>.
            </p>
          </div>
        </div>
        
        {/* Copyright / Extra info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} DDTips. Vse pravice pridržane.
          </p>
        </div>
      </div>
    </div>
  );
}