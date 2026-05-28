// Storage adapter. Two flavours of storage, each with two backends:
//
//   put()         — PUBLIC assets (property photos, floor plans). Served
//                   directly by URL.  dev: public/uploads/ · prod: public bucket.
//   putDocument() — PRIVATE assets (mandates, title deeds, deed plans).
//                   NEVER served by URL — bytes are proxied through the
//                   /api/.../documents/[id]/download route so every access
//                   can be logged.  dev: .devdata/documents/ (outside public/) ·
//                   prod: separate PRIVATE Supabase bucket.
//
// Both flavours expose a consistent {url|key, storageKey} surface that the
// repo layer doesn't have to branch on.

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { usingDevData } from "@/lib/devUsers";
import { supabase, STORAGE_BUCKET, DOCUMENTS_BUCKET } from "@/lib/supabase";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const DOCUMENTS_DIR = path.join(process.cwd(), ".devdata", "documents");

const IMAGE_EXTS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
};

/** Document MIME allowlist: PDFs + images (scanned deeds are often photos
 *  of paper). Driven by the same map so the extension we save with matches
 *  the MIME. */
const DOCUMENT_EXTS: Record<string, string> = {
  ...IMAGE_EXTS,
  "application/pdf": "pdf",
};

export function isAllowedImage(mime: string): boolean {
  return mime in IMAGE_EXTS;
}

export function isAllowedDocument(mime: string): boolean {
  return mime in DOCUMENT_EXTS;
}

/** Size cap per file. Documents get a bigger budget because scanned
 *  multi-page title deeds can be large. */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

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

/* ----------------------------- documents ----------------------------- */

/** Storage key used by the documents bucket / dev folder. We namespace by
 *  property so a future "delete all docs for property X" is a directory
 *  remove instead of a metadata query. */
function documentKey(propertyId: string, docId: string, mime: string): string {
  const ext = DOCUMENT_EXTS[mime] ?? "bin";
  return `${propertyId}/${docId}.${ext}`;
}

export async function putDocument(
  buf: Buffer,
  mime: string,
  propertyId: string,
  docId: string
): Promise<{ key: string }> {
  if (!isAllowedDocument(mime)) {
    throw new Error(`Disallowed document MIME type: ${mime}`);
  }
  const key = documentKey(propertyId, docId, mime);

  if (usingDevData) {
    const fullPath = path.join(DOCUMENTS_DIR, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buf);
    return { key };
  }

  const sb = supabase();
  const { error } = await sb.storage
    .from(DOCUMENTS_BUCKET)
    .upload(key, buf, { contentType: mime, upsert: true });
  if (error) throw new Error(`Document upload failed: ${error.message}`);
  return { key };
}

/** Stream the raw bytes of a private document back. Caller is expected to
 *  have already auth-gated and logged the access. */
export async function getDocumentBytes(storageKey: string): Promise<Buffer> {
  if (usingDevData) {
    const fullPath = path.join(DOCUMENTS_DIR, storageKey);
    // Resolve and verify the path doesn't escape the documents dir — defence
    // against a crafted storage_key like "../../etc/passwd".
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(DOCUMENTS_DIR) + path.sep)) {
      throw new Error("Refusing to read outside documents directory.");
    }
    return fs.readFile(resolved);
  }
  const sb = supabase();
  const { data, error } = await sb.storage.from(DOCUMENTS_BUCKET).download(storageKey);
  if (error || !data) throw new Error(`Document fetch failed: ${error?.message ?? "no data"}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteDocumentFile(storageKey: string): Promise<void> {
  if (usingDevData) {
    const fullPath = path.join(DOCUMENTS_DIR, storageKey);
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(DOCUMENTS_DIR) + path.sep)) {
      throw new Error("Refusing to delete outside documents directory.");
    }
    try {
      await fs.unlink(resolved);
    } catch (e) {
      // Missing file is OK — the row may already be orphaned; nothing else to do.
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    return;
  }
  const sb = supabase();
  const { error } = await sb.storage.from(DOCUMENTS_BUCKET).remove([storageKey]);
  if (error) throw new Error(`Document delete failed: ${error.message}`);
}
