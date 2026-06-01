"use client";

// Gallery layout editor (page 5). Two steps:
//   1. Per-photo SIZE — S / M / L drives each photo's target row height.
//   2. Pick one of THREE layout previews — each shows the actual photos
//      arranged using a different row-grouping strategy.
//
// The layout engine (lib/brochure/gallery-layout.ts) guarantees tile aspect
// ratio = photo aspect ratio for every photo. No cropping, no whitespace.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_SIZES,
  ALL_VARIANTS,
  VARIANT_LABELS,
  VARIANT_BLURBS,
  layoutGallery,
  suggestSize,
  classifyShape,
  enforceMaxOneLarge,
  type Size,
  type Shape,
  type Variant,
} from "@/lib/brochure/gallery-layout";
import { ModalShell, modalBtnCancel } from "@/components/ModalShell";

const SHAPE_LABEL: Record<Shape, string> = {
  landscape: "Landscape",
  portrait: "Portrait",
  square: "Square",
  unknown: "Detecting…",
};

const SIZE_HINT: Record<Size, string> = {
  S: "Small — short row",
  M: "Medium — taller row",
  L: "Large — biggest row (max 1)",
};

export interface GalleryLayoutEditorProps {
  propertyId: string;
  photos: string[];
  photoDimensions: Array<{ w: number; h: number } | null | undefined>;
  onChange: (state: {
    galleryOrder: string[];
    gallerySizes: Size[];
    galleryVariant: Variant;
  }) => void;
}

export function GalleryLayoutEditor({
  propertyId,
  photos,
  photoDimensions,
  onChange,
}: GalleryLayoutEditorProps) {
  const photoCount = Math.min(5, Math.max(0, photos.length - 1));

  // Client-side dimension detection for older photos missing server dims.
  const [detectedDims, setDetectedDims] = useState<Record<string, { w: number; h: number }>>({});

  const aspectByUrl = useMemo(() => {
    const m: Record<string, number | undefined> = {};
    photos.forEach((url, i) => {
      const serverDim = photoDimensions[i];
      const clientDim = detectedDims[url];
      const d = serverDim && serverDim.w && serverDim.h ? serverDim : clientDim;
      m[url] = d && d.w && d.h ? d.w / d.h : undefined;
    });
    return m;
  }, [photos, photoDimensions, detectedDims]);

  useEffect(() => {
    const needs: string[] = [];
    photos.forEach((url, i) => {
      const serverDim = photoDimensions[i];
      if (serverDim && serverDim.w && serverDim.h) return;
      if (detectedDims[url]) return;
      needs.push(url);
    });
    if (needs.length === 0) return;

    let cancelled = false;
    Promise.all(
      needs.map(
        (url) =>
          new Promise<{ url: string; w: number; h: number } | null>((resolve) => {
            const img = new window.Image();
            img.onload = () => resolve({ url, w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => resolve(null);
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
      setDetectedDims((curr) => ({ ...curr, ...next }));
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

  const initialOrder = useMemo(() => photos.slice(1, 6), [photos]);

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [sizes, setSizes] = useState<Size[]>(() =>
    initialOrder.map((url, i) => suggestSize(aspectByUrl[url], i))
  );
  const [variant, setVariant] = useState<Variant>("stacked");
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [userTouched, setUserTouched] = useState(false);
  const [expandedVariant, setExpandedVariant] = useState<Variant | null>(null);

  // Re-suggest sizes once all aspects are known (only if user hasn't touched).
  useEffect(() => {
    if (userTouched) return;
    const hasUnknown = order.some((u) => aspectByUrl[u] === undefined);
    if (hasUnknown) return;
    const next = order.map((u, i) => suggestSize(aspectByUrl[u], i));
    const same = next.every((s, i) => s === sizes[i]);
    if (!same) setSizes(enforceMaxOneLarge(next));
  }, [aspectByUrl, order, sizes, userTouched]);

  // Bubble state up.
  useEffect(() => {
    onChange({ galleryOrder: order, gallerySizes: sizes, galleryVariant: variant });
  }, [order, sizes, variant, onChange]);

  if (photoCount === 0) return null;

  function setSizeAt(i: number, s: Size) {
    setUserTouched(true);
    setSizes((curr) => {
      const next = [...curr];
      next[i] = s;
      // Newest L wins: demote any other L to M.
      if (s === "L") {
        for (let j = 0; j < next.length; j++) {
          if (j !== i && next[j] === "L") next[j] = "M";
        }
      }
      return next;
    });
  }

  function moveAt(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    setUserTouched(true);
    setOrder((curr) => {
      const next = [...curr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSizes((curr) => {
      const next = [...curr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function pickForSlot(slotIdx: number, url: string) {
    setUserTouched(true);
    setOrder((curr) => {
      const next = [...curr];
      const existingTile = next.indexOf(url);
      if (existingTile >= 0 && existingTile !== slotIdx) {
        next[existingTile] = next[slotIdx];
      }
      next[slotIdx] = url;
      return next;
    });
    setEditingSlot(null);
  }

  function resetToSuggested() {
    setUserTouched(false);
    setOrder(initialOrder);
    setSizes(
      enforceMaxOneLarge(initialOrder.map((url, i) => suggestSize(aspectByUrl[url], i)))
    );
    setVariant("stacked");
  }

  // Build a render-time PhotoInput[] for the layout previews — uses
  // current order, sizes, aspects.
  const layoutInputs = useMemo(
    () =>
      order.map((url, i) => ({
        url,
        aspect: aspectByUrl[url] ?? 1.0,
        size: sizes[i],
      })),
    [order, sizes, aspectByUrl]
  );

  return (
    <section className="border border-hairline/15 bg-paper p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-eyebrow uppercase text-ash">Gallery layout (page 5)</p>
          <p className="mt-1 text-sm text-ink-mute">
            Step 1 — set the size of each photo. Step 2 — pick a layout below.
            Photos always fill their tiles exactly: no cropping, no white edges.
          </p>
        </div>
        <button
          type="button"
          onClick={resetToSuggested}
          className="text-eyebrow uppercase text-ash hover:text-gold-deep"
        >
          ↺ Reset
        </button>
      </div>

      {/* Step 1: per-photo size + order */}
      <ul className="mt-5 space-y-3">
        {order.map((url, i) => {
          const aspect = aspectByUrl[url];
          const shape = classifyShape(aspect);
          const currentSize = sizes[i];
          const isFirst = i === 0;
          const isLast = i === order.length - 1;
          return (
            <li
              key={url + i}
              className="flex flex-wrap items-center gap-3 border border-hairline/15 bg-ivory p-2.5"
            >
              <button
                type="button"
                onClick={() => setEditingSlot(i)}
                title="Click to swap this photo"
                className="relative h-16 w-16 flex-shrink-0 overflow-hidden border border-hairline/20 bg-ivory-deep hover:border-gold-deep"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-ink">Photo {i + 1}</p>
                <p className="text-[11px] text-ash">
                  {SHAPE_LABEL[shape]}
                  {aspect ? ` · ${aspect.toFixed(2)}:1` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {ALL_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSizeAt(i, s)}
                    title={SIZE_HINT[s]}
                    className={
                      "w-9 border px-2 py-1 text-eyebrow uppercase transition-colors " +
                      (currentSize === s
                        ? "border-gold-deep bg-gold-deep text-paper"
                        : "border-hairline/30 text-ink-mute hover:bg-paper")
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isFirst}
                  onClick={() => moveAt(i, -1)}
                  title="Move earlier"
                  className="border border-hairline/30 px-2 py-1 text-sm hover:bg-paper disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => moveAt(i, 1)}
                  title="Move later"
                  className="border border-hairline/30 px-2 py-1 text-sm hover:bg-paper disabled:cursor-not-allowed disabled:opacity-30"
                >
                  →
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Step 2: layout option cards */}
      <div className="mt-6">
        <p className="text-eyebrow uppercase text-ash">Step 2 · Pick a layout</p>
        <p className="mt-1 text-xs text-ink-mute">
          Click any layout to see it at full brochure size.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {ALL_VARIANTS.map((v) => {
            const isActive = v === variant;
            return (
              <div
                key={v}
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
                    {VARIANT_LABELS[v]}
                  </span>
                  {isActive && (
                    <span className="text-eyebrow uppercase text-gold-deep">✓ selected</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedVariant(v)}
                  title="Click to see at full brochure size"
                  className="group block w-full"
                >
                  <LayoutPreview inputs={layoutInputs} variant={v} />
                  <span className="mt-1 block text-center text-[10px] uppercase tracking-wide text-ash opacity-0 transition-opacity group-hover:opacity-100">
                    ↗ Click to expand
                  </span>
                </button>
                <span className="text-[11px] text-ash">{VARIANT_BLURBS[v]}</span>
                {!isActive && (
                  <button
                    type="button"
                    onClick={() => setVariant(v)}
                    className="mt-1 border border-hairline/30 px-2 py-1 text-eyebrow uppercase text-ink-mute hover:bg-paper"
                  >
                    Use this layout
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-ash">
        The cover (page 1) always uses your primary photo; this page only
        affects the gallery. Each photo always fills its tile completely — the
        tile is shaped to match the photo, so nothing is ever cropped or
        letterboxed.
      </p>

      {/* Expanded layout preview modal */}
      <ModalShell
        open={expandedVariant !== null}
        onClose={() => setExpandedVariant(null)}
        title={expandedVariant ? `${VARIANT_LABELS[expandedVariant]} — full size preview` : ""}
        size="lg"
        actions={
          <>
            <button onClick={() => setExpandedVariant(null)} className={modalBtnCancel}>
              Close
            </button>
            {expandedVariant && expandedVariant !== variant && (
              <button
                onClick={() => {
                  setVariant(expandedVariant);
                  setExpandedVariant(null);
                }}
                className="bg-gold-deep px-4 py-2 text-eyebrow uppercase text-paper hover:bg-ink"
              >
                Use this layout
              </button>
            )}
            {expandedVariant && expandedVariant === variant && (
              <span className="px-4 py-2 text-eyebrow uppercase text-gold-deep">
                ✓ already selected
              </span>
            )}
          </>
        }
      >
        {expandedVariant && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-ink-mute">{VARIANT_BLURBS[expandedVariant]}</p>
            <p className="text-[11px] text-ash">
              This is exactly how the gallery section of page 5 will look,
              rendered at the real brochure page width.
            </p>
            <div className="bg-ivory-deep p-2">
              <LayoutPreview inputs={layoutInputs} variant={expandedVariant} />
            </div>
          </div>
        )}
      </ModalShell>

      {/* Swap-photo modal */}
      <ModalShell
        open={editingSlot !== null}
        onClose={() => setEditingSlot(null)}
        title={editingSlot !== null ? `Pick a photo for slot ${editingSlot + 1}` : ""}
        actions={
          <button onClick={() => setEditingSlot(null)} className={modalBtnCancel}>
            Cancel
          </button>
        }
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((url, photoIdx) => {
            const aspect = aspectByUrl[url];
            const shape = classifyShape(aspect);
            const isCurrent = editingSlot !== null && order[editingSlot] === url;
            const isCover = photoIdx === 0;
            return (
              <button
                key={url}
                type="button"
                onClick={() => editingSlot !== null && pickForSlot(editingSlot, url)}
                className={
                  "relative aspect-square overflow-hidden border-2 bg-ivory-deep transition " +
                  (isCurrent
                    ? "border-gold-deep ring-2 ring-gold-deep/30"
                    : "border-transparent hover:border-hairline/40")
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {isCover && (
                  <span className="absolute left-1 top-1 bg-ink/75 px-1 py-0.5 text-[9px] uppercase tracking-wide text-paper">
                    Cover
                  </span>
                )}
                <span className="absolute right-1 top-1 bg-ink/70 px-1 py-0.5 text-[9px] text-paper">
                  {photoIdx + 1}
                </span>
                <span className="absolute bottom-1 left-1 right-1 truncate bg-ink/60 px-1 py-0.5 text-center text-[9px] uppercase tracking-wide text-paper">
                  {shape}
                </span>
              </button>
            );
          })}
        </div>
      </ModalShell>
    </section>
  );
}

/** Renders a layout variant as the actual photo arrangement, fitting 100%
 *  of its parent container's width. Uses CSS aspect-ratio on each row so
 *  row height is automatically proportional to container width.
 *
 *  Math guarantee: tile aspect ratio = photo aspect ratio at ANY container
 *  width. Photos always fill their tiles edge-to-edge with no cropping
 *  and no whitespace, whether shown in a 200px card or a 600px modal. */
function LayoutPreview({
  inputs,
  variant,
}: {
  inputs: Array<{ url: string; aspect: number; size: Size }>;
  variant: Variant;
}) {
  // Run the layout at the REAL brochure width so row groupings match
  // exactly what the brochure produces. The output's pixel heights are
  // converted to aspect ratios for the row containers — CSS handles the
  // actual rendering size based on the parent container.
  const REAL_PAGE_W = 682;
  const rows = useMemo(
    () => layoutGallery(inputs, variant, REAL_PAGE_W),
    [inputs, variant]
  );
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
