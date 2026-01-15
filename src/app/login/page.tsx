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
        // --- 1. REGISTRACIJA V SUPABASE ---
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail(email), password });
        if (error) throw error;
        
        // --- 2. 📧 POŠLJI EMAIL OBVESTILO ADMINU ---
        try {
            await fetch("/api/notify-admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    new_user_email: cleanEmail(email) 
                }),
            });
        } catch (emailError) {
            console.error("Napaka pri pošiljanju emaila:", emailError);
            // Registracije ne ustavimo, če email spodleti
        }

        if (!data.session) { 
            setMsg("Uspešno! Preverite email za potrditev."); 
            setMsgType("success"); 
        } else { 
            setMsg("Račun ustvarjen! Počakajte na odobritev."); 
            setMsgType("success"); 
            setTimeout(() => router.replace("/pending"), 1500); 
        }

      } else {
        // --- PRIJAVA (LOGIN) ---
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail(email), password });
        if (error) throw error;
        
        if (data.user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_approved')
                .eq('id', data.user.id)
                .single();

            if (profile && profile.is_approved === true) {
                setMsg("Dobrodošli!"); 
                setMsgType("success"); 
                setTimeout(() => router.replace("/"), 500); 
            } else {
                setMsg("Vaš račun še čaka na odobritev administratorja.");
                setMsgType("error");
                setTimeout(() => router.replace("/pending"), 1500);
            }
        } else {
            setMsg("Prijava ni uspela."); 
            setMsgType("error"); 
        }
      }
    } catch (error: any) { 
        setMsg(error.message || "Prišlo je do napake."); 
        setMsgType("error"); 
    } finally { 
        setLoading(false); 
    }
  }

  // ... (Preostanek tvojega UI-ja ostane enak kot prej)
  return (
    <main className="relative h-screen w-full flex flex-col items-center justify-start pt-64 overflow-hidden bg-black font-sans selection:bg-emerald-500/30">
      {/* (Koda za ozadje in obrazec ostaja ista) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img src="/images/ozadje-login.png" alt="Background" className="w-full h-full object-cover opacity-40 grayscale-[0.3]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1120] via-black/80 to-black" />
      </div>

      <div className="relative z-10 w-full max-w-[500px] px-6 animate-in fade-in slide-in-from-bottom-12 duration-700">
        <div className="relative w-full rounded-[2.5rem] border border-white/10 shadow-2xl ring-1 ring-white/5 overflow-visible">
            <div className="absolute inset-0 rounded-[2.5rem] bg-[#09090b]/95 backdrop-blur-xl"></div>
            <div className="relative px-10 pb-12 pt-36 flex flex-col items-center">
                <form onSubmit={handleSubmit} className="w-full space-y-5">
                    <div className="group relative">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500">
                            <Mail className="w-5 h-5" />
                        </div>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email Address"
                            className="w-full pl-14 pr-4 py-5 bg-black/60 border border-zinc-800 rounded-2xl text-white text-[14px] focus:outline-none focus:border-emerald-500/50 transition-all duration-300"
                        />
                    </div>
                    <div className="group relative">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500">
                            <Lock className="w-5 h-5" />
                        </div>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password"
                            className="w-full pl-14 pr-4 py-5 bg-black/60 border border-zinc-800 rounded-2xl text-white text-[14px] focus:outline-none focus:border-emerald-500/50 transition-all duration-300"
                        />
                    </div>
                    {msg && (
                        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[12px] font-bold ${msgType === "error" ? "border-red-500/20 bg-red-500/5 text-red-400" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"}`}>
                            {msgType === "error" ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} <p>{msg}</p>
                        </div>
                    )}
                    <button type="submit" disabled={loading} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-5 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto text-white" /> : (
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-[13px] font-black uppercase tracking-widest text-white">{view === 'login' ? 'Vstopi' : 'Ustvari račun'}</span>
                                <ArrowRight className="h-4 w-4 text-white" />
                            </div>
                        )}
                    </button>
                </form>
                <div className="mt-10 flex flex-col items-center gap-2">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{view === 'login' ? 'Nimaš računa?' : 'Že imaš račun?'}</p>
                    <button onClick={() => { setView(view === 'login' ? 'register' : 'login'); setMsg(null); }} className="text-[12px] font-black text-white hover:text-emerald-400 transition-colors uppercase underline underline-offset-4">
                        {view === 'login' ? 'Registracija' : 'Prijava'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </main>
  );
}