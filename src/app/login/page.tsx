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
        
        try {
            await fetch("/api/send-telegram/notify-admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ new_user_email: cleanEmail(email) }),
            });
        } catch (emailError) {
            console.error("Napaka pri pošiljanju emaila:", emailError);
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

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-black font-sans selection:bg-emerald-500/30">
      
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img 
          src="/images/ozadje-login.png" 
          alt="Background" 
          className="w-full h-full object-cover opacity-30" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black" />
      </div>

      {/* Decorative Blurs */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[180px] pointer-events-none" />

      <style jsx global>{`
        /* Glass Card Style */
        .glass-login {
          position: relative;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.08) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 25px 50px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .glass-login::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.03),
            transparent
          );
          transition: 0.8s;
          pointer-events: none;
        }

        .glass-login:hover::before {
          left: 100%;
        }

        /* Glass Input Style */
        .glass-input {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .glass-input:focus {
          border-color: rgba(16, 185, 129, 0.5);
          box-shadow: 
            0 0 20px rgba(16, 185, 129, 0.15),
            0 0 0 1px rgba(16, 185, 129, 0.1) inset;
        }

        /* Glass Button Style */
        .glass-button {
          position: relative;
          background: linear-gradient(
            135deg,
            rgba(16, 185, 129, 0.9) 0%,
            rgba(16, 185, 129, 0.7) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 
            0 15px 35px rgba(16, 185, 129, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .glass-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.2),
            transparent
          );
          transition: 0.5s;
        }

        .glass-button:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 20px 40px rgba(16, 185, 129, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.2) inset;
        }

        .glass-button:hover::before {
          left: 100%;
        }

        .glass-button:active {
          transform: translateY(0) scale(0.98);
        }

        /* Logo Container */
        .logo-container {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 20;
        }

        .logo-glass {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.1) 0%,
            rgba(255, 255, 255, 0.05) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 
            0 25px 50px rgba(0, 0, 0, 0.4),
            0 0 30px rgba(16, 185, 129, 0.1),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        /* Message Glass */
        .glass-message {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
      `}</style>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[440px] px-6 pt-16">
        <div className="relative">
          
          {/* Logo - Half Inside, Half Outside */}
          <div className="logo-container">
            <div className="logo-glass rounded-2xl p-4">
              <img 
                src="/images/logo-full.png" 
                alt="DDTips Logo" 
                className="h-16 w-auto object-contain"
              />
            </div>
          </div>

          {/* Glass Card */}
          <div className="glass-login rounded-[2rem] overflow-hidden">
            <div className="px-8 sm:px-10 pb-10 pt-20 flex flex-col items-center">
              
              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {view === 'login' ? 'Dobrodošli nazaj' : 'Ustvarite račun'}
                </h1>
                <p className="text-zinc-500 text-sm mt-2">
                  {view === 'login' ? 'Vpišite podatke za dostop' : 'Začnite s svojo športno analitiko'}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="w-full space-y-4">
                
                {/* Email Input */}
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-400 transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    placeholder="Email"
                    className="glass-input w-full pl-14 pr-5 py-4 rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>

                {/* Password Input */}
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-400 transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    placeholder="Geslo"
                    className="glass-input w-full pl-14 pr-5 py-4 rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>

                {/* Message */}
                {msg && (
                  <div className={`glass-message flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-semibold ${
                    msgType === "error" 
                      ? "border-red-500/20 text-red-400" 
                      : "border-emerald-500/20 text-emerald-400"
                  }`}>
                    {msgType === "error" 
                      ? <XCircle className="h-4 w-4 flex-shrink-0" /> 
                      : <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    } 
                    <p>{msg}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="glass-button w-full rounded-xl py-4 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-white" />
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-bold uppercase tracking-wider text-white">
                        {view === 'login' ? 'Vstopi' : 'Ustvari račun'}
                      </span>
                      <ArrowRight className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="w-full flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">ali</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>

              {/* Switch View */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-zinc-500">
                  {view === 'login' ? 'Še nimate računa?' : 'Že imate račun?'}
                </p>
                <button 
                  onClick={() => { setView(view === 'login' ? 'register' : 'login'); setMsg(null); }} 
                  className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {view === 'login' ? 'Registrirajte se' : 'Prijavite se'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-[10px] mt-8 font-medium tracking-wider">
          © 2026 DDTips Analytics. Vse pravice pridržane.
        </p>
      </div>
    </main>
  );
}