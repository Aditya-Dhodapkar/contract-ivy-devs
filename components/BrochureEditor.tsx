"use client";

// Brochure generator. The new per-page pipeline (templates/brochure/*.html +
// /api/properties/[id]/brochure/pdf-v2) generates every slot internally on
// the server. From this UI you just press the button and get the PDF.
//
// A per-page editable preview (edit headlines/intros before render) is a
// follow-up — for now, regeneration is fast enough (~10-15s) that hitting
// the button again gives you a fresh draft if you don't like the first one.

import { useState } from "react";

type Status = "idle" | "rendering" | "error" | "done";

export function BrochureEditor({ propertyId }: { propertyId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [lastFilename, setLastFilename] = useState("");

  async function generatePdf() {
    setStatus("rendering");
    setError("");
    try {
      const res = await fetch(`/api/properties/${propertyId}/brochure/pdf-v2`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Generation failed (HTTP ${res.status}).`);
      }
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
      setLastFilename(filename);
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  const busy = status === "rendering";

  return (
    <div className="space-y-6">
      <div className="border border-hairline/15 bg-paper p-6">
        <p className="text-eyebrow uppercase text-ash">What this does</p>
        <ul className="mt-3 space-y-2 text-sm text-ink-soft">
          <li>· Picks the pages this property qualifies for (cover, glance, location, site plan, gallery, terms).</li>
          <li>· Asks Claude to draft the editorial copy for each page in parallel.</li>
          <li>· Pulls in your photos, floor plan, locality map, and particulars.</li>
          <li>· Renders the whole thing to a six-page A4 PDF.</li>
        </ul>
        <p className="mt-4 text-xs text-ash">
          Generation takes 10–20 seconds. Nothing is saved on the server — the
          file streams straight to your downloads. Hit the button again to get
          a fresh draft.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-hairline/15 pt-5">
        <button
          onClick={generatePdf}
          disabled={busy}
          className="bg-gold-deep px-6 py-3 text-eyebrow uppercase text-paper hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Generating PDF…" : status === "done" ? "Generate again" : "Generate brochure"}
        </button>
        {busy && (
          <p className="text-xs text-ash">
            Drafting copy &amp; rendering — please wait.
          </p>
        )}
        {status === "done" && !busy && (
          <p className="text-xs text-ink-soft">
            Downloaded <span className="font-mono text-ink">{lastFilename}</span>.
          </p>
        )}
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
