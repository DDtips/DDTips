import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // 1. Preverimo, če smo sploh prišli do sem
  console.log("------------------------------------------");
  console.log("✅ API /api/send-telegram JE BIL POKLICAN!");

  try {
    const body = await req.json();
    console.log("📩 Sporočilo prejeto:", body.message);

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // 2. Preverimo nastavitve (ne izpišemo celega tokena zaradi varnosti)
    console.log("🔑 Token obstaja?", token ? "DA" : "NE ❌ (Preveri .env.local)");
    console.log("🆔 Chat ID obstaja?", chatId ? "DA" : "NE ❌ (Preveri .env.local)");
    console.log("👉 Pošiljam na ID:", chatId);

    if (!token || !chatId) {
      console.log("⛔ MANJKAJO NASTAVITVE!");
      return NextResponse.json({ error: "Manjkajo nastavitve." }, { status: 500 });
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    // 3. Pošljemo na Telegram
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: body.message,
        parse_mode: "HTML",
      }),
    });

    const result = await response.json();
    
    // 4. Kaj pravi Telegram?
    if (!response.ok) {
        console.log("❌ TELEGRAM NAPAKA:", result);
    } else {
        console.log("✅ USPEŠNO POSLANO TELEGRAMU!", result);
    }

    return NextResponse.json({ success: true, telegramResult: result });

  } catch (error) {
    console.error("❌ HUDA NAPAKA V API-JU:", error);
    return NextResponse.json({ error: "Napaka strežnika" }, { status: 500 });
  }
}