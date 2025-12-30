"use client";

import { useState } from "react";
import { Mail, Lock, LogIn, UserPlus, AlertCircle } from "lucide-react";

export default function LoginPage() {
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

    // Simulacija API klica
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setLoading(false);
    setMsg("Registracija uspešna ✅ Preveri email in potrdi račun, nato se prijavi.");
    setMsgType("success");
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

    // Simulacija API klica
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setLoading(false);
    setMsg("Prijava uspešna! 🎉");
    setMsgType("success");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: "2s" }}></div>
        </div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur-xl opacity-50"></div>
        
        <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
              Dobrodošli
            </h1>
            <p className="text-blue-200 text-sm">
              Prijavite se za dostop do svoje aplikacije
            </p>
          </div>

          {/* Form */}
          <div className="space-y-5">
            {/* Email Input */}
            <div>
              <label className="block text-white font-semibold mb-2 text-sm">
                Email naslov
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-300" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="ime@domena.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-blue-200/50 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-white font-semibold mb-2 text-sm">
                Geslo
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-300" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-blue-200/50 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all duration-200"
                />
              </div>
            </div>

            {/* Message */}
            {msg && (
              <div className={`flex items-start gap-3 p-4 rounded-xl ${
                msgType === "error" 
                  ? "bg-red-500/20 border border-red-500/30" 
                  : "bg-green-500/20 border border-green-500/30"
              }`}>
                <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                  msgType === "error" ? "text-red-300" : "text-green-300"
                }`} />
                <p className={`text-sm ${
                  msgType === "error" ? "text-red-100" : "text-green-100"
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
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-500 hover:to-purple-500 focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                <LogIn className="w-5 h-5" />
                {loading ? "Prijavljam..." : "Prijava"}
              </button>

              <button
                type="button"
                onClick={signUp}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 border-2 border-white/20 text-white font-bold rounded-xl hover:bg-white/20 hover:border-white/30 focus:outline-none focus:ring-4 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <UserPlus className="w-5 h-5" />
                Registracija
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-center text-blue-200 text-sm">
              Imate težave s prijavo?{" "}
              <button className="text-white font-semibold hover:underline">
                Ponastavite geslo
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
