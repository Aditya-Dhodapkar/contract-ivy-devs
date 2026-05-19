// Storage adapter. Dev backend writes to public/uploads/ so Next serves them
// directly. Production will swap this for Cloudflare R2 / AWS S3 (#124) — the
// interface (put → {url, key}) stays the same, so neither the form nor the
// detail page changes.

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

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
  url: string; // public URL the browser can load
  key: string; // storage key (for later deletion / access logs)
}

export async function put(buf: Buffer, mime: string): Promise<StoredFile> {
  const ext = IMAGE_EXTS[mime] ?? "bin";
  const key = `${crypto.randomUUID()}.${ext}`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOADS_DIR, key), buf);
  return { url: `/uploads/${key}`, key };
}
