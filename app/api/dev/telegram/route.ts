import { NextResponse } from "next/server";
import { sendTelegram, telegramChats } from "@/lib/integrations/telegram";

/** Dev only. GET → lists group chat ids the bot sees. GET ?test=1 → sends a test alert to TELEGRAM_CHAT_ID. */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  if (new URL(req.url).searchParams.get("test")) {
    const ok = await sendTelegram("✅ <b>GRL Command</b> is connected. Form submissions will show up here.");
    return NextResponse.json({ sent: ok, chat: process.env.TELEGRAM_CHAT_ID ?? null });
  }
  return NextResponse.json(await telegramChats());
}
