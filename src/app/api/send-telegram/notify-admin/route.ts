import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  // 1. Pridobimo ključ ZNOTRAJ funkcije
  const apiKey = process.env.RESEND_API_KEY;

  // 2. Preverimo ključ, da preprečimo napako med buildom
  if (!apiKey) {
    // Med buildom Next.js včasih nima dostopa do ENV, 
    // zato vrnemo odgovor, namesto da sesujemo cel build
    return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
  }

  // 3. Inicializacija šele TUKAJ
  const resend = new Resend(apiKey);

  try {
    const { new_user_email } = await request.json();

    const { data, error } = await resend.emails.send({
      from: 'DDTips <onboarding@resend.dev>',
      to: [process.env.ADMIN_EMAIL || 'skolnik.dejan40@gmail.com'],
      subject: '🆕 Nov uporabnik čaka na potrditev',
      html: `<h2>Nov uporabnik!</h2><p>Email: <b>${new_user_email}</b></p>`,
    });

    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}