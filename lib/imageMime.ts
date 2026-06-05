// Single source of truth for the public image pipeline's MIME allowlist, the
// per-file size cap, and the client-side pre-check (Phase 2 — see
// error_handling.md §2.3 / L6). Shared by the server upload route + storage
// adapter (lib/storage.ts) and the client PropertyForm so both enforce
// identical limits without duplicating the rules.
//
// This module is intentionally dependency-free (no fs / next / react) so it can
// be imported from a "use client" component, a server route, and the pure-logic
// test runner alike.

/** MIME → stored file extension for property photos & floor plans. HEIC/HEIF
 *  are accepted on the way in but transcoded to JPEG at upload (see
 *  app/api/upload/route.ts), so in practice nothing is ever *stored* under the
 *  heic/heif MIMEs — they're listed so isAllowedImageMime() recognises a
 *  browser that does tag the upload with an explicit HEIC MIME. */
export const IMAGE_MIME_EXTS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Per-file size cap for property photos / floor plans (10 MB). */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** File extensions we treat as images when the browser gives us no usable MIME
 *  (the common HEIC-from-iPhone case — see precheckImageFile). */
const ALLOWED_IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "heif",
]);

export function isAllowedImageMime(mime: string): boolean {
  return mime in IMAGE_MIME_EXTS;
}

/** Pure client-side pre-check (L6): instant, plain-language feedback before any
 *  upload round-trip. Returns a short problem phrase (rendered as
 *  "Couldn't add <name>: <problem>") or null when the file looks acceptable.
 *  The server upload route remains the real gate.
 *
 *  MIME nuance: HEIC files frequently arrive with an empty or
 *  "application/octet-stream" type because the browser doesn't recognise the
 *  format. We therefore accept a file whose *extension* looks like an image
 *  when its MIME is missing, and only reject on type when the browser gave us
 *  an explicit, non-image MIME — so a real iPhone photo is never bounced before
 *  it even reaches the server. */
export function precheckImageFile(file: {
  name?: string;
  size: number;
  type?: string;
}): string | null {
  const mb = PHOTO_MAX_BYTES / 1024 / 1024;
  if (file.size > PHOTO_MAX_BYTES) {
    return `it's larger than ${mb} MB.`;
  }
  const type = file.type ?? "";
  const ext = (file.name?.split(".").pop() ?? "").toLowerCase();
  const typeKnown = type !== "" && type !== "application/octet-stream";
  const unsupported = "that file type isn't supported (use JPG, PNG, WebP, GIF or HEIC).";
  if (typeKnown) {
    if (!isAllowedImageMime(type)) return unsupported;
  } else if (!ALLOWED_IMAGE_EXTS.has(ext)) {
    return unsupported;
  }
  return null;
}
