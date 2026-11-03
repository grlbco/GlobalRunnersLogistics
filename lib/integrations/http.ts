import "server-only";

export class ApiError extends Error {
  constructor(public service: string, public status: number, public body: string) {
    super(`${service} ${status}: ${body.slice(0, 300)}`);
  }
}

/** fetch + JSON with timeout and retry on 429/5xx. */
export async function callJson<T>(service: string, url: string, init: RequestInit & { timeoutMs?: number; retries?: number } = {}): Promise<T> {
  const { timeoutMs = 20000, retries = 2, ...rest } = init;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, { ...rest, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
      const text = await r.text();
      if (r.ok) return (text ? JSON.parse(text) : {}) as T;
      last = new ApiError(service, r.status, text);
      if (r.status !== 429 && r.status < 500) throw last;
    } catch (e) {
      last = e;
      if (e instanceof ApiError && e.status !== 429 && e.status < 500) throw e;
    }
    await new Promise((res) => setTimeout(res, 800 * 2 ** attempt));
  }
  throw last instanceof Error ? last : new Error(String(last));
}
