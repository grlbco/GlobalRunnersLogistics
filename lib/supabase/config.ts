// Publishable values (safe in the browser by design). Env vars override for other environments.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ercilamdgoyypghzrwic.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_HQjn15fWCWGVLky_6ePhMQ_JJb1zMg1";
