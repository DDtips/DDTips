import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header"; 
import { Toaster } from "sonner"; // Uvoz Toasterja

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

        {/* 👇 SPREMENJENO: Obvestilo na sredini (s trikom) */}
        <Toaster 
          position="bottom-center" // Mora biti "bottom-center", da deluje
          theme="dark"
          richColors
          toastOptions={{
            style: {
              // Pozicija in odmik (Trik za sredino)
              marginBottom: "40vh",                 // Potisne obvestilo skoraj do sredine ekrana
              
              // Izgled (Velik in Premium)
              background: "rgba(15, 15, 20, 0.95)", // Skoraj neprosojno temno ozadje
              backdropFilter: "blur(20px)",         // Blur efekt
              border: "1px solid rgba(255, 255, 255, 0.2)", // Svetlejši rob
              borderRadius: "16px",                 // Malo manj zaobljeno (bolj kot kartica)
              
              // Velikost
              padding: "20px 40px",                 // Veliko prostora
              minWidth: "320px",                    // Širina
              boxShadow: "0 0 50px -10px rgba(0, 0, 0, 0.8)", // Močna senca za globino
              
              // Tekst
              color: "white",
              fontSize: "18px",                     // Večja pisava
              fontWeight: "700",                    // Debela pisava
              letterSpacing: "0.5px",
              textAlign: "center"
            },
          }} 
        />
        
      </body>
    </html>
  );
}