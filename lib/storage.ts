// Storage adapter. Two backends, env-toggled:
//   - dev:  writes to public/uploads/  (Next serves them directly)
//   - prod: writes to a Supabase Storage bucket (public-read)
// The interface (put → {url, key}) is identical, so the form and the detail
// page don't care which backend is active.

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { usingDevData } from "@/lib/devUsers";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const IMAGE_EXTS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
};

export function isAllowedImage(mime: string): boolean {
  return mime in IMAGE_EXTS;
}

export interface StoredFile {
  url: string; // browser-loadable URL
  key: string; // storage key (for later deletion / access logs)
}

export async function put(buf: Buffer, mime: string): Promise<StoredFile> {
  const ext = IMAGE_EXTS[mime] ?? "bin";
  const key = `${crypto.randomUUID()}.${ext}`;

  if (usingDevData) {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOADS_DIR, key), buf);
    return { url: `/uploads/${key}`, key };
  }

  // Production: upload to the configured Supabase Storage bucket.
  const sb = supabase();
  const { error } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(key, buf, { contentType: mime, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(key);
  return { url: data.publicUrl, key };
}
