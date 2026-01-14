"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { 
  Mail, 
  Lock, 
  Loader2, 
  ArrowRight,
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

  function cleanEmail(x: string) { return x.trim().toLowerCase(); }

  function validate(): string | null {
    if (!cleanEmail(email)) return "Vpišite veljaven email.";
    if (!password) return "Vpišite geslo.";
    if (password.length < 6) return "Geslo mora imeti vsaj 6 znakov.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) { setMsg(v); setMsgType("error"); return; }
    setLoading(true); setMsg(null);

    try {
      if (view === "register") {
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail(email), password });
        if (error) throw error;
        if (!data.session) { setMsg("Uspešno! Preverite email."); setMsgType("success"); }
        else { setMsg("Račun ustvarjen!"); setMsgType("success"); setTimeout(() => router.replace("/"), 1000); }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail(email), password });
        if (error) throw error;
        if (!data.session) { setMsg("Prijava ni uspela."); setMsgType("error"); }
        else { setMsg("Dobrodošli!"); setMsgType("success"); setTimeout(() => router.replace("/"), 500); }
      }
    } catch (error: any) { setMsg(error.message); setMsgType("error"); } 
    finally { setLoading(false); }
  }

  return (
    <main className="relative h-screen w-full flex flex-col items-center justify-start pt-64 overflow-hidden bg-black font-sans selection:bg-emerald-500/30">
      
      {/* 1. OZADJE */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img 
          src="/images/ozadje-login.png" 
          alt="Background" 
          className="w-full h-full object-cover opacity-40 grayscale-[0.3]" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1120] via-black/80 to-black" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] mix-blend-soft-light" />
      </div>

      {/* 2. VSEBINA - Širina povečana na 500px */}
      <div className="relative z-10 w-full max-w-[500px] px-6 animate-in fade-in slide-in-from-bottom-12 duration-700">
        
        {/* KARTICA */}
        <div className="relative w-full rounded-[2.5rem] border border-white/10 shadow-2xl ring-1 ring-white/5 overflow-visible">
            
            {/* Oplemeniteno temno ozadje kartice */}
            <div className="absolute inset-0 rounded-[2.5rem] bg-[#09090b]/95 backdrop-blur-xl"></div>
            
            {/* Zgornji rob sijaj */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-70"></div>

            {/* --- VELIK LEBDEČI LOGOTIP --- */}
            {/* Pozicija: -top-28 (112px gor) */}
            <div className="absolute -top-28 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                
                {/* Sijaj za logotipom */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-emerald-500/25 blur-[70px] rounded-full pointer-events-none"></div>
                
                {/* Slika logotipa: w-56 h-56 (224px) */}
                <div className="relative w-56 h-56 drop-shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition-transform duration-500 hover:scale-105">
                    <img src="/images/logo-full.png" alt="DDTips Logo" className="w-full h-full object-contain"/>
                </div>
            </div>

            {/* VSEBINA KARTICE */}
            {/* Povečan pt-36 (144px), da se inputi začnejo pod logotipom */}
            <div className="relative px-10 pb-12 pt-36 flex flex-col items-center">
            
                <form onSubmit={handleSubmit} className="w-full space-y-5">
                    
                    {/* INPUT: EMAIL */}
                    <div className="group relative">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors duration-300 text-zinc-500 group-focus-within:text-emerald-500">
                            <Mail className="w-5 h-5" />
                        </div>
                        <input 
                            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email Address"
                            className="w-full pl-14 pr-4 py-5 bg-black/60 border border-zinc-800 rounded-2xl text-white text-[14px] tracking-wide placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-black/80 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-300"
                        />
                    </div>
                    
                    {/* INPUT: PASSWORD */}
                    <div className="space-y-2">
                        <div className="group relative">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors duration-300 text-zinc-500 group-focus-within:text-emerald-500">
                                <Lock className="w-5 h-5" />
                            </div>
                            <input 
                                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password"
                                className="w-full pl-14 pr-4 py-5 bg-black/60 border border-zinc-800 rounded-2xl text-white text-[14px] tracking-wide placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-black/80 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-300"
                            />
                        </div>
                    </div>

                    {/* ERROR / SUCCESS MESSAGE */}
                    {msg && (
                        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[12px] font-bold animate-in fade-in zoom-in duration-300 ${msgType === "error" ? "border-red-500/20 bg-red-500/5 text-red-400" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"}`}>
                            {msgType === "error" ? <XCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />} <p>{msg}</p>
                        </div>
                    )}

                    {/* ACTION BUTTON - MOČAN ZELEN GRADIENT */}
                    <button type="submit" disabled={loading} className="group/btn relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 p-[1px] shadow-[0_0_25px_-5px_rgba(16,185,129,0.5)] transition-all duration-300 hover:shadow-[0_0_35px_-5px_rgba(16,185,129,0.7)] hover:brightness-110 active:scale-[0.98] mt-2">
                        <div className="relative flex items-center justify-center gap-2 rounded-2xl px-4 py-5 transition-all duration-300">
                            {loading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : (
                                <>
                                    <span className="text-[13px] font-black uppercase tracking-[0.15em] text-white">
                                        {view === 'login' ? 'Vstopi v sistem' : 'Ustvari račun'}
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-white transition-transform duration-300 group-hover/btn:translate-x-1" />
                                </>
                            )}
                        </div>
                    </button>
                </form>

                {/* TOGGLE VIEW - FOOTER */}
                <div className="mt-10 pt-6 w-full flex flex-col items-center gap-2">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        {view === 'login' ? 'Nimaš računa?' : 'Že imaš račun?'}
                    </p>
                    <button onClick={() => { setView(view === 'login' ? 'register' : 'login'); setMsg(null); }} className="text-[12px] font-black text-white hover:text-emerald-400 transition-colors tracking-[0.15em] uppercase hover:underline underline-offset-4 decoration-emerald-500/50">
                        {view === 'login' ? 'Registracija' : 'Prijava'}
                    </button>
                </div>

            </div>
        </div>
        
        {/* Copyright */}
        <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.3em] mt-8 text-center opacity-60">
            &copy; {new Date().getFullYear()} DD Tips Analytics
        </p>
      </div>
    </main>
  );
}