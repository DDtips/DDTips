"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.replace("/bets");
    })();
  }, [router]);

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
    if (v) return setMsg(v);

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
      return;
    }

    // Če je v Supabase vklopljena email potrditev, session ne bo takoj.
    if (!data.session) {
      setMsg("Registracija uspešna ✅ Preveri email in potrdi račun, nato se prijavi.");
      return;
    }

    router.replace("/bets");
  }

  async function signIn() {
    const v = validate();
    if (v) return setMsg(v);

    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail(email),
      password,
    });

    setLoading(false);

    if (error) {
      console.log("SIGNIN ERROR:", error);
      setMsg(error.message);
      return;
    }

    router.replace("/bets");
  }

  return (
    <main style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
      <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 18 }}>Prijava</h1>

      <label style={{ display: "block", marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Email</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          placeholder="npr. ime@domena.com"
          style={inputStyle}
        />
      </label>

      <label style={{ display: "block", marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Geslo</div>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="vsaj 6 znakov"
          style={inputStyle}
        />
      </label>

      <div style={{ display: "flex", gap: 14 }}>
        <button type="button" onClick={signIn} disabled={loading} style={primaryBtn}>
          Prijava
        </button>

        <button type="button" onClick={signUp} disabled={loading} style={ghostBtn}>
          Registracija
        </button>
      </div>

      {msg && <div style={{ marginTop: 18, opacity: 0.9 }}>{msg}</div>}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "18px 16px",
  borderRadius: 18,
  border: "2px solid rgba(255,255,255,0.20)",
  background: "transparent",
  color: "#fff",
  outline: "none",
  fontSize: 18,
};

const primaryBtn: React.CSSProperties = {
  padding: "14px 22px",
  borderRadius: 16,
  border: "2px solid rgba(255,255,255,0.20)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 20,
};

const ghostBtn: React.CSSProperties = {
  padding: "14px 22px",
  borderRadius: 16,
  border: "2px solid rgba(255,255,255,0.20)",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 20,
};

