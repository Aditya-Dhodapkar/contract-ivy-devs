"use client";

// Template-based gallery editor for page 5. Shows the user 1-5 hand-curated
// template options that fit her photos, each as a preview card rendered
// with her actual photos. Click to select, click to expand to full size.
//
// Photo order is set in the property form (the existing photo grid with
// ← → arrows). The first non-cover photo lands in slot 1 of whichever
// template she picks.
//
// "Let AI design" button calls /ai-layout which returns
// { templateId, photoOrder }. The editor switches to that template and
// surfaces the AI's photo order.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  templatesForCount,
  getTemplate,
  type Template,
} from "@/lib/brochure/templates";
import {
  layoutTemplate,
  templateFits,
  classifyShape,
  type Shape,
} from "@/lib/brochure/gallery-layout";
import { ModalShell, modalBtnCancel } from "@/components/ModalShell";

const SHAPE_LABEL: Record<Shape, string> = {
  landscape: "Landscape",
  portrait: "Portrait",
  square: "Square",
  unknown: "Detecting…",
};

export interface GalleryTemplateEditorProps {
  propertyId: string;
  /** All property photos. photos[0] = cover; gallery uses photos[1..]. */
  photos: string[];
  /** Pixel dimensions aligned to `photos`. */
  photoDimensions: Array<{ w: number; h: number } | null | undefined>;
  /** Called whenever the selected template OR photo order changes. */
  onChange: (state: { templateId: string; galleryOrder: string[] }) => void;
}

export function GalleryTemplateEditor({
  propertyId,
  photos,
  photoDimensions,
  onChange,
}: GalleryTemplateEditorProps) {
  // Client-side dimension detection (older photos missing server dims).
  const [detectedDims, setDetectedDims] = useState<Record<string, { w: number; h: number }>>({});
  const aspectByUrl = useMemo(() => {
    const m: Record<string, number> = {};
    photos.forEach((url, i) => {
      const s = photoDimensions[i];
      const c = detectedDims[url];
      const d = s && s.w && s.h ? s : c;
      m[url] = d && d.w && d.h ? d.w / d.h : 1.0;
    });
    return m;
  }, [photos, photoDimensions, detectedDims]);

  useEffect(() => {
    const needs: string[] = [];
    photos.forEach((url, i) => {
      const s = photoDimensions[i];
      if (s && s.w && s.h) return;
      if (detectedDims[url]) return;
      needs.push(url);
    });
    if (needs.length === 0) return;
    let cancelled = false;
    Promise.all(
      needs.map(
        (url) =>
          new Promise<{ url: string; w: number; h: number } | null>((res) => {
            const img = new window.Image();
            img.onload = () => res({ url, w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => res(null);
            img.src = url;
          })
      )
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, { w: number; h: number }> = {};
      const payload: Array<{ url: string; w: number; h: number }> = [];
      for (const r of results) {
        if (!r || !r.w || !r.h) continue;
        next[r.url] = { w: r.w, h: r.h };
        payload.push(r);
      }
      if (Object.keys(next).length === 0) return;
      setDetectedDims((c) => ({ ...c, ...next }));
      fetch(`/api/properties/${propertyId}/photo-dimensions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimensions: payload }),
      }).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [photos, photoDimensions, detectedDims, propertyId]);

  // Gallery photos = photos[1..5] (cover is page 1, separate).
  const initialOrder = useMemo(() => photos.slice(1, 6), [photos]);
  const [galleryOrder, setGalleryOrder] = useState<string[]>(initialOrder);
  const photoCount = galleryOrder.length;

  // Templates that match this photo count + pass the practicality filter.
  const fittingTemplates = useMemo(() => {
    const candidates = templatesForCount(photoCount);
    const inputs = galleryOrder.map((url) => ({ url, aspect: aspectByUrl[url] ?? 1.0 }));
    return candidates.filter((t) => templateFits(t, inputs));
  }, [photoCount, galleryOrder, aspectByUrl]);

  // Selected template. Default = first fitting template (usually the
  // "single row" option, simplest).
  const [templateId, setTemplateId] = useState<string>(
    fittingTemplates[0]?.id ?? ""
  );
  const [expandedTemplate, setExpandedTemplate] = useState<Template | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Re-default selection if fitting templates change AND current selection
  // is no longer valid (e.g. photo aspects updated after detection).
  useEffect(() => {
    if (fittingTemplates.length === 0) return;
    const stillValid = fittingTemplates.some((t) => t.id === templateId);
    if (!stillValid) setTemplateId(fittingTemplates[0].id);
  }, [fittingTemplates, templateId]);

  // Bubble selection up.
  useEffect(() => {
    onChange({ templateId, galleryOrder });
  }, [templateId, galleryOrder, onChange]);

  // AI design.
  async function runAi() {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(`/api/properties/${propertyId}/brochure/ai-layout`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as {
        templateId?: string;
        photoOrder?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || `AI failed (HTTP ${res.status}).`);
      if (j.templateId) setTemplateId(j.templateId);
      if (j.photoOrder && j.photoOrder.length > 0) setGalleryOrder(j.photoOrder);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  if (photoCount === 0) return null;

  return (
    <section className="border border-hairline/15 bg-paper p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-eyebrow uppercase text-ash">Gallery layout (page 5)</p>
          <p className="mt-1 text-sm text-ink-mute">
            Pick a layout for your {photoCount} gallery photo{photoCount === 1 ? "" : "s"}.
            Every layout renders each photo at its true shape — no cropping, no
            white space.
          </p>
        </div>
        <button
          type="button"
          onClick={runAi}
          disabled={aiLoading}
          className="border border-gold-deep bg-gold-deep px-4 py-2 text-eyebrow uppercase text-paper hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          title="Claude looks at your photos + the property, then picks a layout + photo order for you."
        >
          {aiLoading ? "AI designing…" : "✨ Let AI design"}
        </button>
      </div>

      {aiError && (
        <p className="mt-3 border-l-2 border-red-300 bg-red-50/60 px-3 py-2 text-xs text-red-700">
          {aiError}
        </p>
      )}

      {/* Photo order legend */}
      <div className="mt-5 flex flex-wrap gap-2">
        {galleryOrder.map((url, i) => {
          const shape = classifyShape(aspectByUrl[url]);
          return (
            <div
              key={url + i}
              className="flex items-center gap-2 border border-hairline/15 bg-ivory px-2 py-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-8 w-8 object-cover" />
              <span className="text-[11px] text-ink">
                {i + 1}. <span className="text-ink-mute">{SHAPE_LABEL[shape]}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-ash">
        Photo 1 lands in slot 1 of whichever layout you pick. To change which
        photo goes where, reorder them in the property's photo grid (Edit
        details → Photos → ← →).
      </p>

      {/* Template cards */}
      <div className="mt-5">
        <p className="text-eyebrow uppercase text-ash">
          Layouts ({fittingTemplates.length})
        </p>
        {fittingTemplates.length === 0 ? (
          <p className="mt-3 text-sm text-ink-mute">
            No layout works for your current photos. Try adjusting the photo
            count or aspect ratios.
          </p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fittingTemplates.map((t) => {
              const isActive = t.id === templateId;
              return (
                <div
                  key={t.id}
                  className={
                    "flex flex-col gap-2 border p-3 transition " +
                    (isActive
                      ? "border-gold-deep bg-gold-deep/5 ring-2 ring-gold-deep/30"
                      : "border-hairline/25 hover:border-hairline/50")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        "text-eyebrow uppercase " +
                        (isActive ? "text-gold-deep" : "text-ink-mute")
                      }
                    >
                      {t.label}
                    </span>
                    {isActive && (
                      <span className="text-eyebrow uppercase text-gold-deep">✓</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedTemplate(t)}
                    title="Click to expand"
                    className="group block w-full"
                  >
                    <TemplatePreview
                      template={t}
                      galleryOrder={galleryOrder}
                      aspectByUrl={aspectByUrl}
                    />
                    <span className="mt-1 block text-center text-[10px] uppercase tracking-wide text-ash opacity-0 transition-opacity group-hover:opacity-100">
                      ↗ Expand
                    </span>
                  </button>
                  <span className="text-[11px] text-ash">{t.blurb}</span>
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => setTemplateId(t.id)}
                      className="mt-1 border border-hairline/30 px-2 py-1 text-eyebrow uppercase text-ink-mute hover:bg-paper"
                    >
                      Use this layout
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-ash">
        The cover (page 1) always uses your primary photo; this page only
        affects the gallery. Every layout is hand-designed to show each photo
        at its true aspect — what you see in the preview is what prints.
      </p>

      {/* Expanded preview modal */}
      <ModalShell
        open={expandedTemplate !== null}
        onClose={() => setExpandedTemplate(null)}
        title={expandedTemplate ? `${expandedTemplate.label} — full size` : ""}
        size="lg"
        actions={
          <>
            <button onClick={() => setExpandedTemplate(null)} className={modalBtnCancel}>
              Close
            </button>
            {expandedTemplate && expandedTemplate.id !== templateId && (
              <button
                onClick={() => {
                  setTemplateId(expandedTemplate.id);
                  setExpandedTemplate(null);
                }}
                className="bg-gold-deep px-4 py-2 text-eyebrow uppercase text-paper hover:bg-ink"
              >
                Use this layout
              </button>
            )}
            {expandedTemplate && expandedTemplate.id === templateId && (
              <span className="px-4 py-2 text-eyebrow uppercase text-gold-deep">
                ✓ already selected
              </span>
            )}
          </>
        }
      >
        {expandedTemplate && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-ink-mute">{expandedTemplate.blurb}</p>
            <p className="text-[11px] text-ash">
              This is exactly how page 5 will render — every photo fills its
              tile with no cropping or white edges.
            </p>
            <div className="bg-ivory-deep p-2">
              <TemplatePreview
                template={expandedTemplate}
                galleryOrder={galleryOrder}
                aspectByUrl={aspectByUrl}
              />
            </div>
          </div>
        )}
      </ModalShell>
    </section>
  );
}

/** Renders a template at 100% of its container width using the same
 *  layoutTemplate engine the brochure uses. CSS aspect-ratio per row keeps
 *  proportions correct at any container size. */
function TemplatePreview({
  template,
  galleryOrder,
  aspectByUrl,
}: {
  template: Template;
  galleryOrder: string[];
  aspectByUrl: Record<string, number>;
}) {
  const REAL_PAGE_W = 682;
  const rows = useMemo(() => {
    const inputs = galleryOrder.map((url) => ({ url, aspect: aspectByUrl[url] ?? 1.0 }));
    return layoutTemplate(template, inputs);
  }, [template, galleryOrder, aspectByUrl]);

  return (
    <div className="flex w-full flex-col gap-[2px] bg-ivory-deep">
      {rows.map((row, ri) => (
        <div
          key={ri}
          className="flex w-full justify-center"
          style={{ aspectRatio: `${REAL_PAGE_W} / ${row.height}` }}
        >
          {row.photos.map((p, pi) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={ri + "-" + pi}
              src={p.url}
              alt=""
              style={{
                width: `${p.widthPct}%`,
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
