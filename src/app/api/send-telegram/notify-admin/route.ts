import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { new_user_email } = await request.json();

    const { data, error } = await resend.emails.send({
      from: 'Stavnica App <onboarding@resend.dev>', // Lahko uporabiš privzeto domeno resend.dev za test
      to: [process.env.ADMIN_EMAIL!], // Tvoj email
      subject: '🆕 Nov uporabnik čaka na potrditev',
      html: `
        <h1>Nov uporabnik se je registriral!</h1>
        <p>Email: <strong>${new_user_email}</strong></p>
        <p>Pojdi v Supabase Dashboard (Table Editor -> profiles) in spremeni 'is_approved' na TRUE.</p>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Napaka pri pošiljanju' }, { status: 500 });
  }
}