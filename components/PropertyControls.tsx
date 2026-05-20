"use client";

// Status, website publish, private/access-code, and Owner-only delete.
// Buttons reflect the brief's rules; the API re-checks every one server-side.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PropertyRecord } from "@/lib/repo/properties";
import type { Role } from "@/lib/roles";
import { ApprovalBadge } from "@/components/ApprovalBadge";

export function PropertyControls({
  p,
  role,
}: {
  p: PropertyRecord;
  role: Role;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string>("");

  async function call(url: string, body: unknown, method = "POST") {
    setMsg("");
    const res = await fetch(url, { method, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      router.refresh();
    } else if (j.missing) {
      setMsg("Cannot publish — missing: " + j.missing.join(", "));
    } else {
      setMsg(j.error || "Action failed.");
    }
  }

  const btn =
    "border border-hairline/30 px-3 py-1.5 text-eyebrow uppercase hover:bg-paper";

  const isOwner = role === "owner";

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
                const note = prompt("What needs to change?");
                if (note?.trim()) call(`/api/properties/${p.id}/request-changes`, { note: note.trim() });
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
            className={`h-2 w-2 rounded-full ${
              p.showOnWebsite ? "bg-green-600" : "bg-ash"
            }`}
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
                const code = prompt("Access code for this private listing:");
                if (code) call(`/api/properties/${p.id}/visibility`, { isPrivate: true, accessCode: code });
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
            onClick={() => {
              if (confirm("Delete permanently? This cannot be undone.")) {
                fetch(`/api/properties/${p.id}`, { method: "DELETE" }).then(() => {
                  router.push("/properties");
                  router.refresh();
                });
              }
            }}
          >
            Delete property
          </button>
          <p className="mt-1 text-xs text-ash">Only the owner can delete.</p>
        </div>
      )}

      {msg && <p className="text-sm text-red-700">{msg}</p>}
    </div>
  );
}
