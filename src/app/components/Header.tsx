"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, BarChart3, TrendingUp, Home, Wallet } from "lucide-react";
import { useState, useEffect } from "react";

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
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
          group relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-xs md:text-sm transition-all duration-300
          ${
            isLogout
              ? "text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
              : active
              ? "text-white bg-zinc-800/80 border border-zinc-700/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.15)]"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
          }
        `}
      >
        <Icon
          className={`w-4 h-4 transition-transform duration-300 ${
            active && !isLogout ? "text-emerald-400" : ""
          } ${isLogout ? "group-hover:text-rose-400" : ""}`}
        />
        <span className="hidden sm:block">{label}</span>
        {active && !isLogout && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-emerald-500 rounded-full blur-[1px]" />
        )}
      </Link>
    );
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 border-b ${
        scrolled
          ? "bg-black/80 backdrop-blur-xl border-zinc-800 py-3"
          : "bg-transparent border-transparent py-5"
      }`}
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 flex items-center justify-between">
        {/* Logo area */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="p-2 bg-emerald-500 rounded-lg group-hover:scale-105 transition-transform duration-300 shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)]">
            <Wallet className="w-5 h-5 text-black" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white leading-none">
              DDTips
            </span>
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">
              Analytics
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 p-1 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-md">
          <NavItem href="/" icon={Home} label="Pregled" />
          <NavItem href="/bets" icon={TrendingUp} label="Stave" />
          <NavItem href="/stats" icon={BarChart3} label="Analiza" />
          <div className="w-px h-5 bg-zinc-800 mx-1" />
          <NavItem href="/login" icon={LogOut} label="" variant="logout" />
        </nav>
      </div>
    </header>
  );
}