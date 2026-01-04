"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, BarChart3, TrendingUp, Home } from "lucide-react";
import { useState, useEffect } from "react";

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (href: string) => pathname === href;

  const NavItem = ({ href, icon: Icon, label, variant = "default" }: any) => {
    const active = isActive(href);
    const isLogout = variant === "logout";

    return (
      <Link
        href={href}
        className={`
          group relative flex items-center gap-2.5 px-5 py-2.5 rounded-full font-semibold text-sm tracking-wide
          transition-all duration-300 ease-out overflow-hidden
          ${
            isLogout
              ? "hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-500/20"
              : active
              ? "text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] border border-green-500/30 bg-gradient-to-r from-green-900/40 to-slate-900/40"
              : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
          }
        `}
      >
        {active && !isLogout && (
          <span className="absolute inset-0 bg-green-500/10 rounded-full blur-md" />
        )}
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
        <Icon
          className={`
            w-4 h-4 transition-transform duration-300 group-hover:scale-110
            ${active && !isLogout ? "text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" : ""}
            ${isLogout ? "group-hover:text-red-400" : ""}
          `}
        />
        <span className="relative z-10 hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <header
      className={`
        fixed top-0 inset-x-0 z-[100] transition-all duration-500 border-b
        ${
          scrolled
            ? "bg-[#0B1120]/90 backdrop-blur-xl border-slate-800/60 shadow-2xl shadow-black/50 py-2" // Manjši padding ko skrolaš
            : "bg-transparent border-transparent py-4" // Malo manjši padding na začetku
        }
      `}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-20 bg-green-500/5 blur-[100px] pointer-events-none" />

      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center justify-between">
          
          {/* --- LOGO SEKCIJA (POVEČANA) --- */}
          <Link href="/" className="relative group z-10 flex items-center">
            <img
              src="/images/logo-full.png" // Preveri, če imaš .png ali .jpg!
              alt="DD Tips"
              className={`
                w-auto object-contain transition-all duration-300
                ${scrolled ? "h-16" : "h-24 md:h-28"} 
              `}
              // h-24 je cca 96px, h-28 je 112px (na velikih ekranih)
              // h-16 je 64px (ko skrolaš)
            />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center p-1.5 rounded-full border border-white/5 bg-slate-950/30 backdrop-blur-md shadow-xl">
            <NavItem href="/" icon={Home} label="Home" />
            <NavItem href="/bets" icon={TrendingUp} label="Stave" />
            <NavItem href="/stats" icon={BarChart3} label="Statistika" />
            <div className="w-px h-6 bg-white/10 mx-2" />
            <NavItem href="/login" icon={LogOut} label="Odjava" variant="logout" />
          </nav>
        </div>
      </div>

      <div className={`
        absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/50 to-transparent
        transition-opacity duration-500
        ${scrolled ? "opacity-100" : "opacity-0"}
      `} />
    </header>
  );
}