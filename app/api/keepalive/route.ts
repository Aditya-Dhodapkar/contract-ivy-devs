// Keep-alive ping for free-tier Supabase, which auto-pauses after ~7 days of
// no requests. Vercel Cron (see vercel.json) hits this every few days; the
// single cheap read counts as activity and resets the pause timer. It writes
// nothing — no rows accumulate, nothing to clean up.
//
// Optional auth: if CRON_SECRET is set in the environment, Vercel Cron sends it
// as a Bearer token and we reject anything else, so the endpoint can't be
// poked by randoms. With no secret set it's still harmless (a read of one row).

import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { error } = await supabase().from("users").select("id").limit(1);
  return Response.json({ ok: !error, error: error?.message ?? null });
}
