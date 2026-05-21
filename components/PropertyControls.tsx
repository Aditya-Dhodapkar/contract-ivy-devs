"use client";

// Status, website publish, private/access-code, approval, and Owner-only
// delete. Buttons reflect the brief's rules; the API re-checks every one
// server-side. All confirms/prompts use the themed ModalShell, not the
// native browser dialogs.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PropertyRecord } from "@/lib/repo/properties";
import { can, type Role } from "@/lib/roles";
import { ApprovalBadge } from "@/components/ApprovalBadge";
import { ModalShell, modalBtnCancel, modalBtnDanger, modalBtnPrimary } from "@/components/ModalShell";

export function PropertyControls({
  p,
  role,
}: {
  p: PropertyRecord;
  role: Role;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string>("");

  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [changesNote, setChangesNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(url: string, body: unknown, method = "POST") {
    setMsg("");
    const res = await fetch(url, { method, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      router.refresh();
      return true;
    }
    if (j.missing) {
      setMsg("Cannot publish — missing: " + j.missing.join(", "));
    } else {
      setMsg(j.error || "Action failed.");
    }
    return false;
  }

  const btn =
    "border border-hairline/30 px-3 py-1.5 text-eyebrow uppercase hover:bg-paper";
  const isOwner = role === "owner";

  async function confirmDelete() {
    setBusy(true);
    const res = await fetch(`/api/properties/${p.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.push("/properties");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || "Could not delete.");
      setShowDeleteModal(false);
    }
  }

  async function confirmMakePrivate() {
    if (!accessCode.trim()) return;
    setBusy(true);
    const ok = await call(`/api/properties/${p.id}/visibility`, {
      isPrivate: true,
      accessCode: accessCode.trim(),
    });
    setBusy(false);
    if (ok) {
      setShowPrivateModal(false);
      setAccessCode("");
    }
  }

  async function confirmRequestChanges() {
    if (!changesNote.trim()) return;
    setBusy(true);
    const ok = await call(`/api/properties/${p.id}/request-changes`, {
      note: changesNote.trim(),
    });
    setBusy(false);
    if (ok) {
      setShowChangesModal(false);
      setChangesNote("");
    }
  }

  return (
    <div className="space-y-7 border border-hairline/15 bg-paper p-6">
      <div>
        <p className="text-eyebrow uppercase text-ash">Approval</p>
        <div className="mt-2"><ApprovalBadge approval={p.approval} /></div>
        {p.approval === "changes_requested" && p.changesRequestedNote && (
          <div className="mt-3 border-l-2 border-red-300 bg-red-50/60 px-3 py-2 text-xs text-ink">
            <p className="font-medium text-red-800">Owner requested:</p>
            <p className="mt-1 whitespace-pre-wrap">{p.changesRequestedNote}</p>
          </div>
        )}
        {isOwner ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={p.approval === "approved"}
              onClick={() => call(`/api/properties/${p.id}/approve`, {})}
              className="bg-gold-deep px-3 py-1.5 text-eyebrow uppercase text-paper hover:bg-ink disabled:opacity-40"
            >
              Approve
            </button>
            <button
              onClick={() => {
                setChangesNote("");
                setShowChangesModal(true);
              }}
              className={btn}
            >
              Request changes
            </button>
          </div>
        ) : p.approval === "pending" ? (
          <p className="mt-2 text-xs text-ink-mute">Waiting for the Owner to review.</p>
        ) : null}
      </div>

      {can(role, "generateBrochure") && (
        <div>
          <p className="text-eyebrow uppercase text-ash">Brochure</p>
          <Link
            href={`/properties/${p.id}/brochure`}
            className="mt-3 inline-block w-full bg-gold-deep px-3 py-2.5 text-center text-eyebrow uppercase text-paper hover:bg-ink"
          >
            Create brochure
          </Link>
          <p className="mt-1.5 text-xs text-ash">
            Claude drafts the copy; you review and download the PDF.
          </p>
        </div>
      )}

      <div>
        <p className="text-eyebrow uppercase text-ash">Status</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["draft", "active", "sold", "rented"] as const).map((s) => (
            <button
              key={s}
              className={`${btn} ${p.status === s ? "bg-ink text-paper" : ""}`}
              onClick={() => call(`/api/properties/${p.id}/status`, { status: s })}
            >
              {s}
            </button>
          ))}
        </div>
        {(p.status === "sold" || p.status === "rented") && (
          <p className="mt-2 text-xs text-ink-mute">
            A “{p.status.toUpperCase()}” banner shows on the website photo.
          </p>
        )}
      </div>

      <div>
        <p className="text-eyebrow uppercase text-ash">Website</p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${p.showOnWebsite ? "bg-green-600" : "bg-ash"}`}
            aria-hidden
          />
          <span className="text-sm">
            {p.showOnWebsite ? "Live on website" : "Not on website"}
          </span>
        </div>
        <button
          disabled={!p.showOnWebsite ? p.approval !== "approved" : false}
          onClick={() => call(`/api/properties/${p.id}/publish`, { show: !p.showOnWebsite })}
          className={
            p.showOnWebsite
              ? "mt-3 w-full border border-hairline/30 px-3 py-2 text-eyebrow uppercase text-ink-mute hover:bg-ivory-deep"
              : "mt-3 w-full bg-gold-deep px-3 py-3 text-eyebrow uppercase text-paper hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {p.showOnWebsite ? "Take off website" : "Publish to website"}
        </button>
        {!p.showOnWebsite && p.approval !== "approved" && (
          <p className="mt-1.5 text-xs text-ash">
            Publishing is locked until the Owner approves this property.
          </p>
        )}
        {!p.showOnWebsite && p.approval === "approved" && (
          <p className="mt-1.5 text-xs text-ash">
            Goes live once every required field is filled.
          </p>
        )}
      </div>

      <div>
        <p className="text-eyebrow uppercase text-ash">Private listing</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {p.isPrivate ? (
            <>
              <span className="text-sm">Code: {p.accessCode}</span>
              <button
                className={btn}
                onClick={() => call(`/api/properties/${p.id}/visibility`, { isPrivate: false })}
              >
                Make public-eligible
              </button>
            </>
          ) : (
            <button
              className={btn}
              onClick={() => {
                setAccessCode("");
                setShowPrivateModal(true);
              }}
            >
              Make private
            </button>
          )}
        </div>
      </div>

      {role === "owner" && (
        <div className="border-t border-hairline/15 pt-4">
          <button
            className="text-eyebrow uppercase text-red-700 hover:underline"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete property
          </button>
          <p className="mt-1 text-xs text-ash">Only the owner can delete.</p>
        </div>
      )}

      {msg && <p className="text-sm text-red-700">{msg}</p>}

      {/* --- Modals --- */}

      <ModalShell
        open={showDeleteModal}
        onClose={() => !busy && setShowDeleteModal(false)}
        title="Delete this property?"
        actions={
          <>
            <button onClick={() => setShowDeleteModal(false)} className={modalBtnCancel} disabled={busy}>
              Cancel
            </button>
            <button onClick={confirmDelete} className={modalBtnDanger} disabled={busy}>
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          </>
        }
      >
        <p>
          Reference <span className="font-mono text-ink">{p.referenceNumber}</span> will be
          permanently removed. This cannot be undone.
        </p>
      </ModalShell>

      <ModalShell
        open={showPrivateModal}
        onClose={() => !busy && setShowPrivateModal(false)}
        title="Make this listing private"
        actions={
          <>
            <button onClick={() => setShowPrivateModal(false)} className={modalBtnCancel} disabled={busy}>
              Cancel
            </button>
            <button
              onClick={confirmMakePrivate}
              className={modalBtnPrimary}
              disabled={busy || !accessCode.trim()}
            >
              {busy ? "Saving…" : "Make private"}
            </button>
          </>
        }
      >
        <p>
          A private listing is hidden from the public website. Only people who enter the
          access code can view it.
        </p>
        <label className="mt-4 block">
          <span className="mb-2 block text-eyebrow uppercase text-ink">Access code</span>
          <input
            autoFocus
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && accessCode.trim()) confirmMakePrivate();
            }}
            placeholder="e.g. LAMU2026"
            className="w-full border border-hairline/25 bg-ivory px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>
      </ModalShell>

      <ModalShell
        open={showChangesModal}
        onClose={() => !busy && setShowChangesModal(false)}
        title="Request changes"
        actions={
          <>
            <button onClick={() => setShowChangesModal(false)} className={modalBtnCancel} disabled={busy}>
              Cancel
            </button>
            <button
              onClick={confirmRequestChanges}
              className={modalBtnPrimary}
              disabled={busy || !changesNote.trim()}
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </>
        }
      >
        <p>Tell the agent exactly what to fix. They'll see your note on the property.</p>
        <label className="mt-4 block">
          <span className="mb-2 block text-eyebrow uppercase text-ink">Note</span>
          <textarea
            autoFocus
            value={changesNote}
            onChange={(e) => setChangesNote(e.target.value)}
            rows={4}
            placeholder="e.g. Need better photos of the kitchen and a signed mandate."
            className="w-full border border-hairline/25 bg-ivory px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>
      </ModalShell>
    </div>
  );
}
