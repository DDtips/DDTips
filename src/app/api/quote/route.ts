import { NextResponse } from 'next/server';

// Povemo Vercelu, da se ta koda izvede vsakič znova (ne cache-iraj)
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Kličemo zunanji API (ZenQuotes)
    const res = await fetch('https://zenquotes.io/api/random', {
      cache: 'no-store',
    });

    if (!res.ok) throw new Error('Failed to fetch');

    const data = await res.json();
    
    // Vrnemo podatke nazaj na tvojo spletno stran
    return NextResponse.json(data[0]);
    
  } catch (error) {
    // Če zunanji API ne dela, vrnemo "backup" citat
    return NextResponse.json({
      q: "Uspeh je v podrobnostih.",
      a: "DDTips"
    });
  }
}