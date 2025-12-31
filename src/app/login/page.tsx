"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Mail, Lock, LogIn, UserPlus, AlertCircle, TrendingUp } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"error" | "success">("error");

  function cleanEmail(x: string) {
    return x.trim().toLowerCase();
  }

  function validate(): string | null {
    if (!cleanEmail(email)) return "Vpiši email.";
    if (!password) return "Vpiši geslo.";
    if (password.length < 6) return "Geslo mora imeti vsaj 6 znakov.";
    return null;
  }

  async function signUp() {
    const v = validate();
    if (v) {
      setMsg(v);
      setMsgType("error");
      return;
    }

    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail(email),
      password,
    });

    setLoading(false);

    if (error) {
      console.log("SIGNUP ERROR:", error);
      setMsg(error.message);
      setMsgType("error");
      return;
    }

    if (!data.session) {
      setMsg("Registracija uspešna ✅ Preveri email in potrdi račun, nato se prijavi.");
      setMsgType("success");
      return;
    }

    setMsg("Registracija uspešna! 🎉");
    setMsgType("success");
    
    setTimeout(() => {
      router.replace("/");
    }, 500);
  }

  async function signIn() {
    const v = validate();
    if (v) {
      setMsg(v);
      setMsgType("error");
      return;
    }

    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail(email),
      password,
    });

    setLoading(false);

    if (error) {
      console.log("SIGNIN ERROR:", error);
      setMsg("Napačen email ali geslo.");
      setMsgType("error");
      return;
    }

    if (!data.session) {
      setMsg("Prijava neuspešna. Preveri email in geslo.");
      setMsgType("error");
      return;
    }

    setMsg("Prijava uspešna! 🎉");
    setMsgType("success");
    
    setTimeout(() => {
      router.replace("/");
    }, 500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 antialiased">
      {/* Background - enako kot home stran */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black" />
      <div className="fixed inset-0 opacity-30" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")" }} />

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="relative rounded-2xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-sm p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 rounded-2xl mb-4">
              <TrendingUp className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-light tracking-tight text-white mb-2">
              DDTips
            </h1>
            <p className="text-zinc-500 text-sm">
              Match Analysis & Picks
            </p>
          </div>

          {/* Form */}
          <div className="space-y-5">
            {/* Email Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                Email naslov
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="ime@domena.com"
                  className="w-full pl-11 pr-4 py-3 bg-zinc-800/80 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-800 transition-all duration-300"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                Geslo
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-zinc-800/80 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-800 transition-all duration-300"
                />
              </div>
            </div>

            {/* Message */}
            {msg && (
              <div className={`flex items-start gap-3 p-4 rounded-xl ${
                msgType === "error" 
                  ? "bg-rose-500/10 border border-rose-500/30" 
                  : "bg-emerald-500/10 border border-emerald-500/30"
              }`}>
                <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  msgType === "error" ? "text-rose-400" : "text-emerald-400"
                }`} />
                <p className={`text-sm ${
                  msgType === "error" ? "text-rose-400" : "text-emerald-400"
                }`}>
                  {msg}
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={signIn}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                <LogIn className="w-4 h-4" />
                {loading ? "Prijavljam..." : "Prijava"}
              </button>

              <button
                type="button"
                onClick={signUp}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-zinc-800 border border-zinc-700/50 text-zinc-300 font-semibold rounded-xl hover:bg-zinc-700 hover:text-white hover:border-zinc-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="w-4 h-4" />
                Registracija
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-zinc-800">
            <p className="text-center text-zinc-600 text-sm">
              Imate težave s prijavo?{" "}
              <button className="text-zinc-400 font-medium hover:text-emerald-400 transition-colors">
                Ponastavite geslo
              </button>
            </p>
          </div>
        </div>

        {/* Subtle glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600/10 via-transparent to-emerald-600/10 rounded-2xl blur-xl -z-10" />
      </div>
    </div>
  );
}