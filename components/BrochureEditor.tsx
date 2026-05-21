"use client";

// Client-side editor for brochure slots. On mount, requests Claude to draft
// the copy. User edits in-place. On submit, downloads the PDF.

import { useEffect, useState } from "react";
import type { BrochureSlots } from "@/lib/brochure/types";
import { SLOT_LABELS } from "@/lib/brochure/types";

type Status = "drafting" | "ready" | "error" | "rendering";

const field =
  "w-full border border-hairline/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-gold";
const labelText = "mb-2 block text-eyebrow uppercase text-ink";

export function BrochureEditor({ propertyId }: { propertyId: string }) {
  const [status, setStatus] = useState<Status>("drafting");
  const [slots, setSlots] = useState<BrochureSlots | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      const res = await fetch(`/api/properties/${propertyId}/brochure/draft`, { method: "POST" });
      if (cancelled) return;
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Could not draft brochure copy.");
        setStatus("error");
        return;
      }
      const { slots } = await res.json();
      setSlots(slots);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  async function regenerate() {
    setStatus("drafting");
    setSlots(null);
    setError("");
    const res = await fetch(`/api/properties/${propertyId}/brochure/draft`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not regenerate.");
      setStatus("error");
      return;
    }
    const { slots } = await res.json();
    setSlots(slots);
    setStatus("ready");
  }

  async function downloadPdf() {
    if (!slots) return;
    setStatus("rendering");
    setError("");
    const res = await fetch(`/api/properties/${propertyId}/brochure/pdf`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slots }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not render PDF.");
      setStatus("ready");
      return;
    }
    // Pull the blob and let the browser save it.
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const m = /filename="([^"]+)"/.exec(cd);
    const filename = m?.[1] || "brochure.pdf";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("ready");
  }

  function update<K extends keyof BrochureSlots>(k: K, v: string) {
    setSlots((s) => (s ? { ...s, [k]: v } : s));
  }

  if (status === "drafting" && !slots) {
    return (
      <div className="border border-hairline/15 bg-paper p-8 text-sm text-ink-mute">
        Drafting brochure copy with Claude… (this takes ~10 seconds)
      </div>
    );
  }
  if (status === "error" && !slots) {
    return (
      <div className="border border-red-200 bg-red-50 p-8 text-sm">
        <p className="font-medium text-red-700">{error}</p>
        <button
          onClick={regenerate}
          className="mt-4 border border-red-300 px-3 py-2 text-eyebrow uppercase text-red-700 hover:bg-red-100"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!slots) return null;

  const orderedKeys: (keyof BrochureSlots)[] = [
    "coverTagline",
    "introHeadline",
    "introLede",
    "propertyHeadline",
    "landHeadline",
    "featureHeadline",
    "featureBody",
    "closingHeadline",
  ];

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between border-b border-hairline/15 pb-3">
        <p className="text-sm text-ink-mute">Editorial copy — review &amp; edit</p>
        <button
          onClick={regenerate}
          disabled={status === "drafting"}
          className="text-eyebrow uppercase text-gold-deep hover:underline disabled:opacity-50"
        >
          {status === "drafting" ? "Drafting…" : "Re-draft with Claude"}
        </button>
      </div>

      {orderedKeys.map((k) => {
        const multiline = k === "introLede" || k === "featureBody";
        return (
          <label key={k} className="block">
            <span className={labelText}>{SLOT_LABELS[k]}</span>
            {multiline ? (
              <textarea
                value={slots[k]}
                onChange={(e) => update(k, e.target.value)}
                rows={4}
                className={field}
              />
            ) : (
              <input
                type="text"
                value={slots[k]}
                onChange={(e) => update(k, e.target.value)}
                className={field}
              />
            )}
          </label>
        );
      })}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center gap-3 border-t border-hairline/15 pt-5">
        <button
          onClick={downloadPdf}
          disabled={status === "rendering"}
          className="bg-gold-deep px-6 py-3 text-eyebrow uppercase text-paper hover:bg-ink disabled:opacity-50"
        >
          {status === "rendering" ? "Rendering PDF…" : "Download PDF"}
        </button>
        <p className="text-xs text-ash">
          The file downloads to your computer. Nothing is saved on the server.
        </p>
      </div>
    </div>
  );
}
