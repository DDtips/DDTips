import { NextResponse } from 'next/server';
import { translate } from 'google-translate-api-x';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Pridobi angleški citat
    const res = await fetch('https://zenquotes.io/api/random', {
      cache: 'no-store',
    });

    if (!res.ok) throw new Error('Failed to fetch quote');

    const data = await res.json();
    const originalQuote = data[0]; // { q: "text", a: "author" }

    // 2. Prevedi citat v slovenščino
    // Prevajamo samo tekst (originalQuote.q), avtorja pustimo originalnega
    try {
      const translation = await translate(originalQuote.q, { to: 'sl' });
      
      // Vrnemo preveden tekst
      return NextResponse.json({
        q: translation.text,
        a: originalQuote.a
      });

    } catch (translateError) {
      console.error('Translation failed:', translateError);
      // Če prevajanje ne uspe, vrnemo originalnega angleškega
      return NextResponse.json(originalQuote);
    }
    
  } catch (error) {
    console.error('API Error:', error);
    // Če vse odpove, vrnemo fiksno rezervo
    return NextResponse.json({
      q: "Uspeh je v podrobnostih.",
      a: "DDTips"
    });
  }
}