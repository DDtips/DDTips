"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const navBtn = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        style={{
          padding: "10px 16px",
          borderRadius: 14,
          textDecoration: "none",
          fontWeight: 700,
          color: active ? "#fff" : "#111",
          background: active
            ? "linear-gradient(135deg, #7c3aed, #a855f7)"
            : "rgba(255,255,255,0.8)",
          border: "1px solid rgba(0,0,0,0.1)",
        }}
      >
        {label}
      </Link>
    );
  };

  return (
<header
  style={{
    position: "sticky",
    top: 0,
    zIndex: 50,
    backgroundImage: `
      linear-gradient(
        rgba(255,255,255,0.75),
        rgba(255,255,255,0.75)
      ),
      url("/header-bg.jpg")
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
  }}
>

    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* LOGO */}
        <Link href="/bets" style={{ display: "flex", alignItems: "center" }}>
          <Image
            src="/logo.svg"
            alt="DD Tips"
            width={40}
            height={40}
            priority
          />
        </Link>

        {/* NAV */}
        <nav style={{ display: "flex", gap: 12 }}>
          {navBtn("/bets", "Stave")}
          {navBtn("/stats", "Statistika")}
          {navBtn("/login", "Odjava")}
        </nav>
      </div>
    </header>
  );
}

