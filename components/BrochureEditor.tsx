"use client";

// Brochure generator. The per-page pipeline (templates/brochure/*.html +
// /api/properties/[id]/brochure/pdf-v2) generates every slot internally on
// the server. From this UI you:
//   1. (Optional) Customise which photo goes in which gallery tile on page 5
//      via the GalleryLayoutEditor. If you don't touch it, the server
//      auto-arranges photos by aspect-ratio match.
//   2. Press Generate → ~15s later a six-page PDF downloads.
//
// Regeneration is cheap (~5 cents each) so the workflow is "press it,
// look at it, tweak the layout if needed, press it again."

import { useCallback, useState } from "react";
import { GalleryTemplateEditor } from "@/components/GalleryTemplateEditor";

type Status = "idle" | "rendering" | "error" | "done";

export interface BrochureEditorProps {
  propertyId: string;
  /** All property photos. Used by the gallery layout editor (page 5). */
  photos: string[];
  /** Pixel dimensions aligned to `photos` (drives shape labels). */
  photoDimensions: Array<{ w: number; h: number } | null | undefined>;
  /** Captions aligned to `photos` — included for completeness; the editor
   *  doesn't render them, but the parent will once we surface caption editing. */
  photoCaptions: string[];
}

export function BrochureEditor({
  propertyId,
  photos,
  photoDimensions,
}: BrochureEditorProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [lastFilename, setLastFilename] = useState("");
  // Gallery state from the template editor: which template + photo order.
  const [galleryTemplateId, setGalleryTemplateId] = useState<string>("");
  const [galleryOrder, setGalleryOrder] = useState<string[]>([]);
  const handleGalleryChange = useCallback(
    (state: { templateId: string; galleryOrder: string[] }) => {
      setGalleryTemplateId(state.templateId);
      setGalleryOrder(state.galleryOrder);
    },
    []
  );

  // Gallery page only appears in the brochure when there are ≥3 photos
  // (cover + at least 2 gallery shots). Don't show the editor otherwise.
  const showGalleryEditor = photos.length >= 3;

  async function generatePdf() {
    setStatus("rendering");
    setError("");
    try {
      const payload: { galleryTemplateId?: string; galleryOrder?: string[] } = {};
      if (galleryTemplateId) payload.galleryTemplateId = galleryTemplateId;
      if (galleryOrder.length > 0) payload.galleryOrder = galleryOrder;
      const res = await fetch(`/api/properties/${propertyId}/brochure/pdf-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

      {showGalleryEditor && (
        <GalleryTemplateEditor
          propertyId={propertyId}
          photos={photos}
          photoDimensions={photoDimensions}
          onChange={handleGalleryChange}
        />
      )}

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
