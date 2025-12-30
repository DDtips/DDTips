"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, BarChart3, TrendingUp } from "lucide-react";

export default function Header() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-gradient-to-r from-slate-950/95 via-gray-900/95 to-slate-950/95 border-b border-green-500/30 shadow-2xl">
      <div className="max-w-7xl mx-auto px-6 py-2.5">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link 
            href="/bets" 
            className="flex items-center group"
          >
            <div className="relative group-hover:scale-105 transition-all duration-300">
              <img
                src="/ddtips-logo.png"
                alt="DD Tips"
                style={{ 
                  height: 65, 
                  width: "auto",
                  filter: "drop-shadow(0 4px 12px rgba(16, 185, 129, 0.3)) brightness(1.05) contrast(1.1)"
                }}
              />
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-3">
            {/* Stave */}
            <Link
              href="/bets"
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm
                transition-all duration-200 hover:scale-105 active:scale-95
                ${isActive("/bets")
                  ? "bg-gradient-to-r from-green-600 to-yellow-500 text-white shadow-lg shadow-green-500/40"
                  : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white border border-green-500/20 hover:border-green-500/40"
                }
              `}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Stave</span>
            </Link>

            {/* Statistika */}
            <Link
              href="/stats"
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm
                transition-all duration-200 hover:scale-105 active:scale-95
                ${isActive("/stats")
                  ? "bg-gradient-to-r from-green-600 to-yellow-500 text-white shadow-lg shadow-green-500/40"
                  : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white border border-green-500/20 hover:border-green-500/40"
                }
              `}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Statistika</span>
            </Link>

            {/* Odjava */}
            <Link
              href="/login"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-white/10 text-white/80 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Odjava</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Gradient line matching logo */}
      <div className="h-px bg-gradient-to-r from-transparent via-green-500 via-40% via-yellow-400 via-60% to-transparent opacity-60"></div>
    </header>
  );
}