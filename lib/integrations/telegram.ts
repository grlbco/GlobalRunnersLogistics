import "server-only";

/**
 * Team alerts to a Telegram group (Bot API). Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
 * Silent no-op when not configured, never throws.
 */
export async function sendTelegram(html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: html.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) console.error("telegram", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("telegram error", e);
    return false;
  }
}

export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Dev helper: chats the bot has seen (add the bot to the group, send any message, then call this). */
export async function telegramChats() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { error: "TELEGRAM_BOT_TOKEN is not set" };
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { signal: AbortSignal.timeout(10000) });
  const j = (await res.json()) as { result?: { message?: { chat: { id: number; title?: string; type: string } }; my_chat_member?: { chat: { id: number; title?: string; type: string } } }[] };
  const chats = new Map<number, { id: number; title?: string; type: string }>();
  for (const u of j.result ?? []) {
    const chat = u.message?.chat ?? u.my_chat_member?.chat;
    if (chat) chats.set(chat.id, { id: chat.id, title: chat.title, type: chat.type });
  }
  return { chats: [...chats.values()] };
}
