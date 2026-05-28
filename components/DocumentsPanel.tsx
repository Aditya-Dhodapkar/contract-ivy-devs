"use client";

// Sensitive-document section on the property detail page. Three rows, one
// per doc type (mandate, title_deed, deed_plan). Each row is either empty
// (with an Upload button) or shows the uploaded file with view / download /
// replace / delete actions.
//
// Bytes are never linked directly. View and Download both go through the
// /api/.../download endpoint so every access is logged server-side. The
// access log is viewable by Owner only via a modal.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ModalShell, modalBtnCancel, modalBtnDanger, modalBtnPrimary } from "@/components/ModalShell";

type DocType = "mandate" | "title_deed" | "deed_plan";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  mandate: "Mandate",
  title_deed: "Title deed",
  deed_plan: "Deed plan",
};

const DOC_TYPE_BLURB: Record<DocType, string> = {
  mandate: "Signed authority from the seller. Required before this property can be published.",
  title_deed: "Government proof the seller owns the property.",
  deed_plan: "Registered boundary survey.",
};

interface AccessLogEvent {
  userId: string;
  userEmail: string;
  action: "upload" | "replace" | "view" | "download" | "delete";
  at: string;
}

interface DocumentRecord {
  id: string;
  propertyId: string;
  docType: DocType;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  accessLog: AccessLogEvent[];
}

export function DocumentsPanel({
  propertyId,
  canUpload,
  canDelete,
}: {
  propertyId: string;
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<Record<DocType, DocumentRecord | null>>({
    mandate: null,
    title_deed: null,
    deed_plan: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadingType, setUploadingType] = useState<DocType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [logTarget, setLogTarget] = useState<DocumentRecord | null>(null);
  const [busy, setBusy] = useState(false);

  // File inputs are kept around per row so the Upload / Replace buttons can
  // synthesise a click without re-mounting an <input>.
  const fileInputs = useRef<Record<DocType, HTMLInputElement | null>>({
    mandate: null,
    title_deed: null,
    deed_plan: null,
  });

  useEffect(() => {
    void refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh() {
    setError("");
    try {
      const res = await fetch(`/api/properties/${propertyId}/documents`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed to load documents (HTTP ${res.status}).`);
      }
      const { documents } = (await res.json()) as { documents: DocumentRecord[] };
      const next: Record<DocType, DocumentRecord | null> = {
        mandate: null,
        title_deed: null,
        deed_plan: null,
      };
      documents.forEach((d) => {
        next[d.docType] = d;
      });
      setDocs(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onFilePicked(docType: DocType, file: File | null | undefined) {
    if (!file) return;
    setUploadingType(docType);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("docType", docType);
      const res = await fetch(`/api/properties/${propertyId}/documents`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Upload failed (HTTP ${res.status}).`);
      // Refresh the list and bounce the parent route so the pre-publish gate
      // (mandate uploaded) reflects in the sidebar if it's open.
      await refresh();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingType(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/documents/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Delete failed (HTTP ${res.status}).`);
      setDeleteTarget(null);
      await refresh();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openInline(doc: DocumentRecord) {
    window.open(
      `/api/properties/${propertyId}/documents/${doc.id}/download`,
      "_blank",
      "noopener"
    );
  }

  function forceDownload(doc: DocumentRecord) {
    // Use a hidden anchor so the browser triggers a save without leaving the
    // current page.
    const a = document.createElement("a");
    a.href = `/api/properties/${propertyId}/documents/${doc.id}/download?as=download`;
    a.rel = "noopener";
    a.download = doc.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const order: DocType[] = ["mandate", "title_deed", "deed_plan"];
  const anyDoc = Object.values(docs).some(Boolean);

  return (
    <section id="documents" className="mt-12 scroll-mt-24 border-t border-hairline/15 pt-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif text-2xl text-ink">Documents</h2>
          <p className="mt-1 text-sm text-ink-mute">
            Sensitive legal papers — mandate, title deed, deed plan. Stored
            privately. Every view and download is logged.
          </p>
        </div>
        {canDelete && anyDoc && (
          <button
            onClick={() => {
              // Owner-only access-log viewer — pick the first doc with a log
              // to seed the modal. (Owner can switch by clicking other rows.)
              const seed = order
                .map((t) => docs[t])
                .find((d): d is DocumentRecord => !!d);
              if (seed) setLogTarget(seed);
            }}
            className="text-eyebrow uppercase text-gold-deep hover:underline"
          >
            View access log
          </button>
        )}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-mute">Loading documents…</p>
      ) : (
        <ul className="mt-6 divide-y divide-hairline/15 border-y border-hairline/15">
          {order.map((t) => {
            const doc = docs[t];
            const isUploading = uploadingType === t;
            return (
              <li key={t} className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg text-ink">{DOC_TYPE_LABELS[t]}</p>
                  <p className="mt-0.5 text-xs text-ash">{DOC_TYPE_BLURB[t]}</p>
                  {doc ? (
                    <div className="mt-2 text-xs text-ink-soft">
                      <div className="font-mono">{doc.fileName}</div>
                      <div className="mt-0.5 text-ash">
                        {(doc.sizeBytes / 1024).toFixed(0)} KB · uploaded{" "}
                        {new Date(doc.uploadedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        by {doc.uploadedByName || doc.uploadedBy}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs italic text-ash">— not uploaded —</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={(el) => {
                      fileInputs.current[t] = el;
                    }}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      void onFilePicked(t, f);
                    }}
                  />
                  {doc ? (
                    <>
                      <button
                        onClick={() => openInline(doc)}
                        className="border border-hairline/30 px-2.5 py-1.5 text-eyebrow uppercase hover:bg-paper"
                      >
                        View
                      </button>
                      <button
                        onClick={() => forceDownload(doc)}
                        className="border border-hairline/30 px-2.5 py-1.5 text-eyebrow uppercase hover:bg-paper"
                      >
                        Download
                      </button>
                      {canUpload && (
                        <button
                          onClick={() => fileInputs.current[t]?.click()}
                          disabled={isUploading}
                          className="border border-hairline/30 px-2.5 py-1.5 text-eyebrow uppercase hover:bg-paper disabled:opacity-40"
                        >
                          {isUploading ? "Replacing…" : "Replace"}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(doc)}
                          className="border border-red-300 px-2.5 py-1.5 text-eyebrow uppercase text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setLogTarget(doc)}
                          title="View access log for this document"
                          className="text-eyebrow uppercase text-ash hover:text-gold-deep"
                        >
                          Log ({doc.accessLog.length})
                        </button>
                      )}
                    </>
                  ) : canUpload ? (
                    <button
                      onClick={() => fileInputs.current[t]?.click()}
                      disabled={isUploading}
                      className="bg-gold-deep px-3 py-1.5 text-eyebrow uppercase text-paper hover:bg-ink disabled:opacity-40"
                    >
                      {isUploading ? "Uploading…" : "Upload"}
                    </button>
                  ) : (
                    <span className="text-xs italic text-ash">
                      Your role can&apos;t upload documents
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="mt-4 border-l-2 border-red-300 bg-red-50/60 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <p className="mt-4 text-xs text-ash">
        PDFs and images up to 25 MB each. Uploading replaces any existing file
        of the same type. Documents are never on a public URL — bytes only
        leave the server through an authenticated download.
      </p>

      <ModalShell
        open={!!deleteTarget}
        onClose={() => !busy && setDeleteTarget(null)}
        title={`Delete the ${deleteTarget ? DOC_TYPE_LABELS[deleteTarget.docType] : ""}?`}
        actions={
          <>
            <button onClick={() => setDeleteTarget(null)} className={modalBtnCancel} disabled={busy}>
              Cancel
            </button>
            <button onClick={confirmDelete} className={modalBtnDanger} disabled={busy}>
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          </>
        }
      >
        <p>
          This removes the file and its access log entirely. The deletion is
          permanent — there is no undo.
        </p>
        {deleteTarget && (
          <p className="mt-2 font-mono text-xs text-ink">{deleteTarget.fileName}</p>
        )}
      </ModalShell>

      <ModalShell
        open={!!logTarget}
        onClose={() => setLogTarget(null)}
        title={`Access log — ${logTarget ? DOC_TYPE_LABELS[logTarget.docType] : ""}`}
        actions={
          <button onClick={() => setLogTarget(null)} className={modalBtnPrimary}>
            Close
          </button>
        }
      >
        {logTarget && (
          <div className="max-h-80 overflow-y-auto">
            {logTarget.accessLog.length === 0 ? (
              <p className="text-sm text-ink-mute">No access events yet.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {[...logTarget.accessLog]
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .map((e, i) => (
                    <li key={i} className="flex justify-between gap-4 border-b border-hairline/10 pb-1.5">
                      <span className="font-mono uppercase text-ink">{e.action}</span>
                      <span className="flex-1 text-ink-soft">{e.userEmail}</span>
                      <span className="text-ash">{new Date(e.at).toLocaleString("en-GB")}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </ModalShell>
    </section>
  );
}
