import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
// Preveri pot: glede na tvojo sliko je mapa components v mapi app, torej je tole prav:
import Header from "./components/Header"; 

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DDTips Analytics",
  description: "Betting Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sl">
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#0b0b14] text-white min-h-screen selection:bg-emerald-500/30`}
      >
        <Header />
        {children}
      </body>
    </html>
  );
}