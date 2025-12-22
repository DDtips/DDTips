"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const linkStyle = (href: string) => ({
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.22)",
    background: pathname === href ? "rgba(168,85,247,0.18)" : "transparent",
    color: "white",
    textDecoration: "none",
    fontWeight: 700 as const,
  });

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header
      style={{
        height: 72,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(15, 15, 26, 0.75)",
        backdropFilter: "blur(10px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* LEFT: LOGO */}
      <Link
        href="/bets"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          textDecoration: "none",
        }}
      >
        <Image
          src="/logo.svg" // če je pri tebi logo.svg -> zamenjaj v "/logo.svg"
          alt="DD Tips"
          width={44}
          height={44}
          priority
        />
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ fontWeight: 900, color: "#a855f7", fontSize: 18 }}>
            DD
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
            Tips
          </div>
        </div>
      </Link>

      {/* RIGHT: NAV */}
      <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link href="/bets" style={linkStyle("/bets")}>
          Stave
        </Link>
        <Link href="/stats" style={linkStyle("/stats")}>
          Statistika
        </Link>
        <button
          onClick={logout}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.22)",
            background: "transparent",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Odjava
        </button>
      </nav>
    </header>
  );
}


