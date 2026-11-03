import "server-only";

/** Team alert by email (Resend). Silent no-op if not configured. */
export async function notifyTeam(subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL_TO;
  const from = process.env.NOTIFY_EMAIL_FROM;
  if (!key || !to || !from) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()), subject, text }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // alerts are best-effort
  }
}
