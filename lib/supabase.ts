// Supabase server client. Service-role key — full DB access. ONLY ever
// imported by server code (route handlers, server components, server actions).
// The service key bypasses Row-Level Security; every API route guards itself
// via lib/guard.ts + lib/roles.ts before touching the repo, so RLS is deferred.
//
// Active when USE_DEV_DATA=false. In dev mode the repo layer never reaches
// for this client — the JSON-file backend is used instead.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env not set. Set USE_DEV_DATA=true for local dev, or fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || "property-photos";
