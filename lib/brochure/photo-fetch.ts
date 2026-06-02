// Convert a photo URL — local /uploads/... or external (Supabase Storage,
// Mapbox, etc.) — into a base64 data URL the Anthropic SDK can accept as
// an image source. Used by the caption-drafting endpoints (which need
// Claude to actually see the photo) and any future vision-driven path.

import { promises as fs } from "fs";
import path from "path";

const FETCH_TIMEOUT_MS = 15_000;

export async function photoUrlToDataUrl(url: string): Promise<string> {
  if (!url) throw new Error("photoUrlToDataUrl called with empty URL.");

  // Local /uploads/foo.jpg → read from public/.
  if (url.startsWith("/")) {
    const safe = path.normalize(url).replace(/^\/+/, "");
    const full = path.join(process.cwd(), "public", safe);
    const buf = await fs.readFile(full);
    const ext = (full.split(".").pop() || "jpg").toLowerCase();
    const mime =
      ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
      ext === "gif" ? "image/gif" :
      "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  }

  // External — fetch and base64-encode.
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Photo fetch failed (${res.status}) for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // Strip charset / params from content-type if present.
  const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  return `data:${ct};base64,${buf.toString("base64")}`;
}
