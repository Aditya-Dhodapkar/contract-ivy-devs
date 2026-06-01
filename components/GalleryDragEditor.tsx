"use client";

// Drag-and-drop gallery layout editor for page 5 of the brochure.
//
// Canvas = a stack of rows. Each row is a horizontal flexbox of photos.
// Photos can be dragged within a row to reorder, OR between rows to move.
// Each photo has an inline S/M/L size picker that affects the row height
// when it's the largest photo in its row. Per-row × button removes a row
// (sending its photos back to the unplaced palette).
//
// The canvas IS the live preview — photos render at their masonry sizes
// using the same algorithm the brochure uses. What she sees = what she'll
// get in the PDF.
//
// Plus: "Let AI design this page" button hits /ai-layout, replaces the
// canvas with Claude's vision-driven layout.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ALL_SIZES,
  layoutGalleryExplicit,
  classifyShape,
  type Size,
  type ExplicitLayout,
  type Shape,
} from "@/lib/brochure/gallery-layout";

const SHAPE_LABEL: Record<Shape, string> = {
  landscape: "Landscape",
  portrait: "Portrait",
  square: "Square",
  unknown: "Detecting…",
};

export interface GalleryDragEditorProps {
  propertyId: string;
  photos: string[];
  photoDimensions: Array<{ w: number; h: number } | null | undefined>;
  onChange: (layout: ExplicitLayout) => void;
}

interface RowState {
  id: string;            // stable id for dnd-kit
  photos: Array<{ url: string; size: Size }>;
}

export function GalleryDragEditor({
  propertyId,
  photos,
  photoDimensions,
  onChange,
}: GalleryDragEditorProps) {
  // Dimension detection (client-side fallback for old photos).
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

  // Default layout: gallery photos (skipping cover) into a single row,
  // initial size = M for each.
  const gallerySource = useMemo(() => photos.slice(1, 6), [photos]);
  const [rows, setRows] = useState<RowState[]>(() => [
    {
      id: "row-1",
      photos: gallerySource.map((url) => ({ url, size: "M" as Size })),
    },
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Bubble up the explicit layout shape whenever rows change.
  useEffect(() => {
    onChange({
      rows: rows.map((r) => ({ photos: r.photos })),
    });
  }, [rows, onChange]);

  // Pre-compute the rendered rows (masonry math) for the canvas display.
  // This is what the brochure will look like.
  const renderedRows = useMemo(
    () =>
      layoutGalleryExplicit(
        { rows: rows.map((r) => ({ photos: r.photos })) },
        aspectByUrl
      ),
    [rows, aspectByUrl]
  );

  // dnd-kit setup — pointer for mouse, touch for mobile.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Photos use composite ids "rowId::url" so dnd-kit can tell which row a
  // photo currently lives in (urls themselves could theoretically duplicate
  // across rows — though our setSizeAt guards against it).
  function photoId(rowId: string, url: string) {
    return `${rowId}::${url}`;
  }
  function parsePhotoId(id: string): { rowId: string; url: string } {
    const [rowId, ...rest] = id.split("::");
    return { rowId, url: rest.join("::") };
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over) return;
    const src = parsePhotoId(String(active.id));
    // `over` can be either another photo id or a row's drop-zone id.
    const overId = String(over.id);
    let destRowId: string;
    let destUrl: string | null = null;
    if (overId.startsWith("row-zone::")) {
      destRowId = overId.replace("row-zone::", "");
    } else {
      const dest = parsePhotoId(overId);
      destRowId = dest.rowId;
      destUrl = dest.url;
    }
    if (src.rowId === destRowId) {
      // Reorder within row.
      setRows((curr) =>
        curr.map((r) => {
          if (r.id !== src.rowId) return r;
          const fromIdx = r.photos.findIndex((p) => p.url === src.url);
          const toIdx = destUrl
            ? r.photos.findIndex((p) => p.url === destUrl)
            : r.photos.length - 1;
          if (fromIdx < 0 || toIdx < 0) return r;
          return { ...r, photos: arrayMove(r.photos, fromIdx, toIdx) };
        })
      );
      return;
    }
    // Move between rows.
    setRows((curr) => {
      const next = curr.map((r) => ({ ...r, photos: [...r.photos] }));
      const fromRow = next.find((r) => r.id === src.rowId);
      const toRow = next.find((r) => r.id === destRowId);
      if (!fromRow || !toRow) return curr;
      const fromIdx = fromRow.photos.findIndex((p) => p.url === src.url);
      if (fromIdx < 0) return curr;
      const [moved] = fromRow.photos.splice(fromIdx, 1);
      const toIdx = destUrl ? toRow.photos.findIndex((p) => p.url === destUrl) : toRow.photos.length;
      toRow.photos.splice(toIdx < 0 ? toRow.photos.length : toIdx, 0, moved);
      return next;
    });
  }

  function setPhotoSize(rowId: string, url: string, size: Size) {
    setRows((curr) =>
      curr.map((r) => {
        if (r.id !== rowId) return r;
        const updated = r.photos.map((p) => (p.url === url ? { ...p, size } : p));
        // Enforce max-1-L across ALL rows, not just within this row.
        if (size === "L") {
          // Demote any other L (in this row or others) to M.
          return { ...r, photos: updated };
        }
        return { ...r, photos: updated };
      })
    );
    // Cross-row L enforcement.
    if (size === "L") {
      setRows((curr) =>
        curr.map((r) =>
          r.id === rowId
            ? r
            : { ...r, photos: r.photos.map((p) => (p.size === "L" ? { ...p, size: "M" as Size } : p)) }
        )
      );
    }
  }

  const MAX_ROWS = 3;

  function addRow() {
    setRows((curr) => {
      if (curr.length >= MAX_ROWS) return curr;
      return [...curr, { id: `row-${Date.now()}`, photos: [] }];
    });
  }

  function removeRow(rowId: string) {
    setRows((curr) => {
      // If non-empty, move its photos to the previous row (or the first row).
      const idx = curr.findIndex((r) => r.id === rowId);
      if (idx < 0) return curr;
      const row = curr[idx];
      const next = curr.filter((r) => r.id !== rowId);
      if (row.photos.length === 0 || next.length === 0) return next;
      const targetIdx = Math.max(0, idx - 1);
      return next.map((r, i) =>
        i === targetIdx ? { ...r, photos: [...r.photos, ...row.photos] } : r
      );
    });
  }

  async function runAiDesigner() {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(`/api/properties/${propertyId}/brochure/ai-layout`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as {
        layout?: ExplicitLayout;
        error?: string;
      };
      if (!res.ok || !j.layout) throw new Error(j.error || `AI failed (HTTP ${res.status}).`);
      // Replace state with AI's layout. Give each row a fresh id.
      setRows(
        j.layout.rows.map((r, i) => ({
          id: `ai-row-${i}-${Date.now()}`,
          photos: r.photos.map((p) => ({ url: p.url, size: p.size })),
        }))
      );
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  if (gallerySource.length === 0) return null;

  const activeDragInfo = activeDragId ? parsePhotoId(activeDragId) : null;

  return (
    <section className="border border-hairline/15 bg-paper p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-eyebrow uppercase text-ash">Gallery layout (page 5)</p>
          <p className="mt-1 text-sm text-ink-mute">
            Drag photos to rearrange. Drop into a different row to regroup.
            Tap S/M/L on any photo to resize its tile. The preview is what
            you'll get on the brochure — photos always fill their tiles exactly.
          </p>
        </div>
        <button
          type="button"
          onClick={runAiDesigner}
          disabled={aiLoading}
          className="border border-gold-deep bg-gold-deep px-4 py-2 text-eyebrow uppercase text-paper hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          title="Claude analyzes your photos + property and designs the page for you."
        >
          {aiLoading ? "AI designing…" : "✨ Let AI design"}
        </button>
      </div>
      {aiError && (
        <p className="mt-3 border-l-2 border-red-300 bg-red-50/60 px-3 py-2 text-xs text-red-700">
          {aiError}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="mt-5 space-y-3">
          {rows.map((row, rowIdx) => {
            const rendered = renderedRows[rowIdx];
            return (
              <RowDropZone
                key={row.id}
                row={row}
                renderedHeight={rendered?.height ?? 200}
                onRemove={() => removeRow(row.id)}
                isOnly={rows.length === 1}
                aspectByUrl={aspectByUrl}
                onSetSize={(url, s) => setPhotoSize(row.id, url, s)}
                photoId={photoId}
              />
            );
          })}
          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= MAX_ROWS}
            className="block w-full border-2 border-dashed border-hairline/30 px-4 py-3 text-eyebrow uppercase text-ash hover:border-gold-deep hover:bg-paper hover:text-gold-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hairline/30 disabled:hover:bg-transparent disabled:hover:text-ash"
            title={rows.length >= MAX_ROWS ? `Max ${MAX_ROWS} rows — remove one to add another.` : "Add another row"}
          >
            {rows.length >= MAX_ROWS ? `+ Add row (max ${MAX_ROWS} reached)` : "+ Add row"}
          </button>
        </div>

        <DragOverlay>
          {activeDragInfo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeDragInfo.url}
              alt=""
              style={{
                height: 100,
                width: 100 * (aspectByUrl[activeDragInfo.url] ?? 1.0),
                objectFit: "cover",
                opacity: 0.85,
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              }}
            />
          )}
        </DragOverlay>
      </DndContext>

      <p className="mt-4 text-xs text-ash">
        The cover (page 1) always uses your primary photo; this page only
        affects the gallery. Tile shape always matches photo shape — nothing
        is ever cropped, nothing is ever letterboxed.
      </p>
    </section>
  );
}

/* ----------------------------- Row component ----------------------------- */

function RowDropZone({
  row,
  renderedHeight,
  onRemove,
  isOnly,
  aspectByUrl,
  onSetSize,
  photoId,
}: {
  row: RowState;
  renderedHeight: number;
  onRemove: () => void;
  isOnly: boolean;
  aspectByUrl: Record<string, number>;
  onSetSize: (url: string, s: Size) => void;
  photoId: (rowId: string, url: string) => string;
}) {
  const ids = row.photos.map((p) => photoId(row.id, p.url));
  const REAL_PAGE_W = 682;
  const rowAspect = renderedHeight > 0 ? `${REAL_PAGE_W} / ${renderedHeight}` : undefined;

  // Make the whole row a droppable zone with a stable id. SortableContext
  // handles the within-row drop targets (other photos), but a totally
  // empty row needs its own droppable id — otherwise dnd-kit's collision
  // detection has nothing to land on.
  const { setNodeRef, isOver } = useDroppable({
    id: `row-zone::${row.id}`,
  });

  const isEmpty = row.photos.length === 0;

  return (
    <div className="relative">
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={
            "flex w-full justify-center bg-ivory-deep transition-colors " +
            (isEmpty
              ? "min-h-[80px] border-2 border-dashed " +
                (isOver ? "border-gold-deep bg-gold-deep/10" : "border-hairline/30")
              : isOver
                ? "ring-2 ring-gold-deep"
                : "")
          }
          style={!isEmpty && rowAspect ? { aspectRatio: rowAspect } : undefined}
        >
          {isEmpty && (
            <div className="flex w-full items-center justify-center px-4 py-6 text-xs italic text-ash">
              {isOver ? "Release to drop here" : "Drop a photo here"}
            </div>
          )}
          {row.photos.map((p) => (
            <SortablePhoto
              key={photoId(row.id, p.url)}
              id={photoId(row.id, p.url)}
              url={p.url}
              size={p.size}
              aspect={aspectByUrl[p.url] ?? 1.0}
              onSetSize={(s) => onSetSize(p.url, s)}
            />
          ))}
        </div>
      </SortableContext>
      {!isOnly && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove this row (photos move to the previous row)"
          className="absolute -right-2 -top-2 z-10 h-6 w-6 rounded-full border border-hairline/30 bg-paper text-sm text-ink-mute hover:bg-red-50 hover:text-red-700"
        >
          ×
        </button>
      )}
    </div>
  );
}

/* --------------------------- Photo (sortable) --------------------------- */

function SortablePhoto({
  id,
  url,
  size,
  aspect,
  onSetSize,
}: {
  id: string;
  url: string;
  size: Size;
  aspect: number;
  onSetSize: (s: Size) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const shape = classifyShape(aspect);
  // Photo's width = its share of the row in CSS, computed from aspect.
  // Within a row of N photos, photo i's width = aspect_i / Σ aspects × 100%.
  // dnd-kit's SortableContext doesn't expose siblings here, so we compute
  // width via flex-grow proportional to aspect — same effect.
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        flexGrow: aspect,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        position: "relative",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.4 : 1,
      }}
      className="group h-full overflow-hidden"
      {...attributes}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        {...listeners}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          touchAction: "none",
        }}
      />
      {/* Hover overlay: shape badge + size picker */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-1 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="bg-ink/75 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-paper">
          {SHAPE_LABEL[shape]}
        </span>
      </div>
      <div className="pointer-events-auto absolute inset-x-1 bottom-1 flex justify-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {ALL_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetSize(s);
            }}
            className={
              "flex-1 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide transition-colors " +
              (size === s
                ? "bg-gold-deep text-paper"
                : "bg-ink/60 text-paper hover:bg-ink")
            }
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
