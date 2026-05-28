// Data-access layer for property documents (mandates, title deeds, deed plans).
// Two interchangeable backends, mirroring the properties repo:
//   - dev:  JSON file at .devdata/documents.json   (USE_DEV_DATA=true)
//   - prod: Supabase Postgres `property_documents` (USE_DEV_DATA=false)
//
// Documents are sensitive (signed papers, ID numbers, addresses). The storage
// layer keeps them out of any public URL — this module just persists metadata
// + the access log. The download route is the only place the raw bytes leave
// the server, and it always logs the access first.

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { usingDevData } from "@/lib/devUsers";
import { supabase } from "@/lib/supabase";
import {
  putDocument,
  getDocumentBytes,
  deleteDocumentFile,
} from "@/lib/storage";

export type DocType = "mandate" | "title_deed" | "deed_plan";

export const DOC_TYPES: DocType[] = ["mandate", "title_deed", "deed_plan"];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  mandate: "Mandate",
  title_deed: "Title deed",
  deed_plan: "Deed plan",
};

export type AccessAction = "upload" | "replace" | "view" | "download" | "delete";

export interface AccessLogEvent {
  userId: string;
  userEmail: string;
  action: AccessAction;
  at: string; // ISO timestamp
}

export interface DocumentRecord {
  id: string;
  propertyId: string;
  docType: DocType;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;       // userId
  uploadedByName: string;   // denormalised for UI; resolved at write time
  uploadedAt: string;       // ISO
  accessLog: AccessLogEvent[];
}

interface ActingUser {
  id: string;
  email: string;
  name: string;
}

/* ------------------- row ↔ record mapping (prod only) ------------------- */

type Row = Record<string, unknown>;

function fromRow(r: Row): DocumentRecord {
  return {
    id: r.id as string,
    propertyId: r.property_id as string,
    docType: r.doc_type as DocType,
    storageKey: (r.storage_key as string) ?? "",
    fileName: (r.file_name as string) ?? "",
    mimeType: (r.mime_type as string) ?? "application/octet-stream",
    sizeBytes: (r.size_bytes as number) ?? 0,
    uploadedBy: (r.uploaded_by as string) ?? "",
    uploadedByName: (r.uploaded_by_name as string) ?? "",
    uploadedAt: r.uploaded_at as string,
    accessLog: (r.access_log as AccessLogEvent[]) ?? [],
  };
}

function toRow(rec: DocumentRecord): Row {
  return {
    id: rec.id,
    property_id: rec.propertyId,
    doc_type: rec.docType,
    storage_key: rec.storageKey,
    file_name: rec.fileName,
    mime_type: rec.mimeType,
    size_bytes: rec.sizeBytes,
    uploaded_by: rec.uploadedBy,
    uploaded_by_name: rec.uploadedByName,
    uploaded_at: rec.uploadedAt,
    access_log: rec.accessLog,
  };
}

/* ----------------------------- dev backend ----------------------------- */

const DEV_FILE = path.join(process.cwd(), ".devdata", "documents.json");

async function devReadAll(): Promise<DocumentRecord[]> {
  try {
    return JSON.parse(await fs.readFile(DEV_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function devWriteAll(rows: DocumentRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(rows, null, 2));
}

// Single in-process mutex covers all document writes — uploads,
// access-log appends, and deletes. JSONB access_log is read-modify-write
// in both backends; the mutex makes the dev backend race-safe.
let writeMutex: Promise<unknown> = Promise.resolve();
function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeMutex.then(fn, fn);
  writeMutex = next.catch(() => undefined);
  return next;
}

/* --------------------------- public repo API --------------------------- */

/** All documents for a property, ordered mandate → title_deed → deed_plan
 *  so the UI doesn't have to sort. */
export async function listForProperty(propertyId: string): Promise<DocumentRecord[]> {
  const all = await readAllForProperty(propertyId);
  const order: Record<DocType, number> = { mandate: 0, title_deed: 1, deed_plan: 2 };
  return all.sort((a, b) => order[a.docType] - order[b.docType]);
}

async function readAllForProperty(propertyId: string): Promise<DocumentRecord[]> {
  if (usingDevData) {
    const all = await devReadAll();
    return all.filter((d) => d.propertyId === propertyId);
  }
  const { data, error } = await supabase()
    .from("property_documents")
    .select("*")
    .eq("property_id", propertyId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

export async function getDocumentRecord(docId: string): Promise<DocumentRecord | null> {
  if (usingDevData) {
    const all = await devReadAll();
    return all.find((d) => d.id === docId) ?? null;
  }
  const { data, error } = await supabase()
    .from("property_documents")
    .select("*")
    .eq("id", docId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data) : null;
}

/** Upload a new document for a property + doc_type, replacing any existing
 *  doc of the same type. The prior file is removed from storage; the
 *  access log carries the full history including the replacement event. */
export async function uploadDocument(args: {
  propertyId: string;
  docType: DocType;
  buf: Buffer;
  mime: string;
  fileName: string;
  uploader: ActingUser;
}): Promise<DocumentRecord> {
  const { propertyId, docType, buf, mime, fileName, uploader } = args;
  const now = new Date().toISOString();

  return withWriteLock(async () => {
    // Look for an existing doc of this type to replace.
    const existing = (await readAllForProperty(propertyId)).find(
      (d) => d.docType === docType
    );

    const docId = existing?.id ?? `doc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const { key } = await putDocument(buf, mime, propertyId, docId);

    // If the new file has a different extension than the prior one, the
    // old storage key is orphaned — remove it. (Same-extension replacements
    // overwrite at the same key via upsert.)
    if (existing && existing.storageKey && existing.storageKey !== key) {
      try {
        await deleteDocumentFile(existing.storageKey);
      } catch {
        /* non-fatal — orphan file at worst */
      }
    }

    const event: AccessLogEvent = {
      userId: uploader.id,
      userEmail: uploader.email,
      action: existing ? "replace" : "upload",
      at: now,
    };

    const record: DocumentRecord = {
      id: docId,
      propertyId,
      docType,
      storageKey: key,
      fileName,
      mimeType: mime,
      sizeBytes: buf.length,
      uploadedBy: uploader.id,
      uploadedByName: uploader.name,
      uploadedAt: now,
      accessLog: existing ? [...existing.accessLog, event] : [event],
    };

    if (usingDevData) {
      const all = await devReadAll();
      const next = existing
        ? all.map((d) => (d.id === existing.id ? record : d))
        : [...all, record];
      await devWriteAll(next);
      return record;
    }

    const { error } = await supabase()
      .from("property_documents")
      .upsert(toRow(record), { onConflict: "id" });
    if (error) throw new Error(error.message);
    return record;
  });
}

/** Append a view / download event to a document's access log without
 *  touching any other field. Caller is responsible for ensuring the viewer
 *  has been auth-gated already. */
export async function logAccess(
  docId: string,
  action: "view" | "download",
  viewer: ActingUser
): Promise<void> {
  const event: AccessLogEvent = {
    userId: viewer.id,
    userEmail: viewer.email,
    action,
    at: new Date().toISOString(),
  };
  await withWriteLock(async () => {
    if (usingDevData) {
      const all = await devReadAll();
      const next = all.map((d) =>
        d.id === docId ? { ...d, accessLog: [...d.accessLog, event] } : d
      );
      await devWriteAll(next);
      return;
    }
    // Read-modify-write on the JSONB — acceptable for low-volume access.
    const sb = supabase();
    const { data, error } = await sb
      .from("property_documents")
      .select("access_log")
      .eq("id", docId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const log = (data?.access_log as AccessLogEvent[] | undefined) ?? [];
    const { error: uerr } = await sb
      .from("property_documents")
      .update({ access_log: [...log, event] })
      .eq("id", docId);
    if (uerr) throw new Error(uerr.message);
  });
}

/** Remove a document (storage file + DB row). Owner-only — caller MUST have
 *  already enforced that via the guard layer. */
export async function deleteDocument(
  docId: string,
  deleter: ActingUser
): Promise<void> {
  await withWriteLock(async () => {
    const existing = await getDocumentRecord(docId);
    if (!existing) return; // already gone — idempotent
    try {
      await deleteDocumentFile(existing.storageKey);
    } catch {
      /* swallow — DB row still gets cleaned up */
    }
    // The access_log goes away with the row by design (no separate audit
    // table). `deleter` is unused for now; capture point for a future audit
    // sink if we ever need one.
    void deleter;

    if (usingDevData) {
      const all = await devReadAll();
      await devWriteAll(all.filter((d) => d.id !== docId));
      return;
    }
    const { error } = await supabase()
      .from("property_documents")
      .delete()
      .eq("id", docId);
    if (error) throw new Error(error.message);
  });
}

/** Pre-publish gate (#59): does this property have an uploaded mandate?
 *  Same signature as the original stub — `lib/prepublish.ts` calls this
 *  directly and we don't change anything about how it's wired. */
export async function hasMandateDoc(propertyId: string): Promise<boolean> {
  const docs = await readAllForProperty(propertyId);
  return docs.some((d) => d.docType === "mandate");
}

/** Resolve the raw bytes for a document. Caller MUST have auth-gated and
 *  is responsible for calling logAccess() to record the read. */
export async function readDocumentBytes(docId: string): Promise<{
  record: DocumentRecord;
  bytes: Buffer;
} | null> {
  const record = await getDocumentRecord(docId);
  if (!record) return null;
  const bytes = await getDocumentBytes(record.storageKey);
  return { record, bytes };
}
