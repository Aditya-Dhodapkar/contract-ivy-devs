// Row-based masonry layout for the gallery page (page 5). Pure functions,
// safe in both server and client bundles.
//
// The fundamental guarantee:
//   For every photo, the rendered tile aspect ratio exactly equals the
//   photo's native aspect ratio. So `object-fit` is irrelevant — there is
//   no cropping (the tile is shaped to fit the photo) and no whitespace
//   (the photo is sized to fill the tile).
//
// How the row math works:
//   1. Each photo has a SIZE (S/M/L) which maps to a target row HEIGHT.
//   2. Photos are grouped into rows by a VARIANT strategy:
//        stacked  → group consecutive same-size photos into rows
//        hero     → one big photo on its own row; rest in one balanced row
//        compact  → everything packed at medium height in 1-2 rows
//   3. For each row at target height H:
//        natural_w_i = H * photo_aspect_i
//        sum_natural_w = Σ natural_w_i
//        scale = page_w / sum_natural_w      (so the row fills the page)
//        actual_h = H * scale
//        actual_w_i = actual_h * aspect_i    (each tile keeps its photo's aspect)
//   4. If actual_h would exceed MAX_ROW_H (a sanity cap), we instead use
//      MAX_ROW_H and let the row sit at less than page width (centered).

const PAGE_W = 682; // A4 inner width @96dpi
/** Vertical budget for the gallery section on page 5. Used by layoutTemplate
 *  to scale down rows that, together, exceed the available page height. */
const PAGE_BUDGET = 700;
/** Practical max for a single row. Used by templateFits — a template is
 *  filtered out if any single row would render this tall, because at that
 *  scale you'd lose most of the page to one image and leave no room for
 *  siblings. Solo portraits naturally hit this. */
const MAX_SINGLE_ROW_H = 600;

export type Size = "S" | "M" | "L";
export const ALL_SIZES: Size[] = ["S", "M", "L"];

export type Variant = "stacked" | "hero" | "compact";
export const ALL_VARIANTS: Variant[] = ["stacked", "hero", "compact"];

export const VARIANT_LABELS: Record<Variant, string> = {
  stacked: "Grouped by size",
  hero: "Hero focus",
  compact: "Compact",
};

export const VARIANT_BLURBS: Record<Variant, string> = {
  stacked: "One row per size: Large photo on top, Medium row, then Small row.",
  hero: "Your largest photo on top, the rest in a single row below.",
  compact: "Everything packed tight in 1-2 rows at the same height.",
};

/** Target row height per size category, in CSS pixels. */
const SIZE_HEIGHT: Record<Size, number> = {
  S: 140,
  M: 220,
  L: 320,
};

/** Photo + its chosen size, the input to the layout engine. */
export interface PhotoInput {
  url: string;
  aspect: number;       // natural width / natural height
  size: Size;
}

/** A photo's render position inside a row. widthPct = % of page width. */
export interface RenderedPhoto {
  url: string;
  widthPct: number;     // 0..100
}

/** A laid-out row of photos. Total widthPct may be < 100 when MAX_ROW_H
 *  kicked in (single tall photo can't fill page width without overflowing
 *  vertically — we cap height and center the row). */
export interface Row {
  height: number;       // CSS pixels
  photos: RenderedPhoto[];
}

/** Pack a list of photos into a single row at the given target height.
 *  Always scales the row to fill page width exactly (widthPcts sum to 100).
 *  Solo rows of tall photos can end up very tall — `layoutTemplate` enforces
 *  the page budget by uniformly scaling all rows down if needed. */
function packRow(items: PhotoInput[], targetH: number, pageW: number): Row {
  if (items.length === 0) return { height: 0, photos: [] };
  const totalNatW = items.reduce((s, p) => s + targetH * p.aspect, 0);
  const scale = pageW / totalNatW;
  const actualH = targetH * scale;
  const photos = items.map((p) => ({
    url: p.url,
    widthPct: (actualH * p.aspect) / pageW * 100,
  }));
  return { height: actualH, photos };
}

/** Target row height per row-photo-count. Hand-tuned so the typical case
 *  (landscape photos) produces editorial proportions: hero rows feel big,
 *  multi-photo rows feel comfortable but not cramped. */
function targetHeightForRowSize(n: number): number {
  switch (n) {
    case 1: return 420;
    case 2: return 300;
    case 3: return 220;
    case 4: return 170;
    default: return 140;
  }
}

/** Explicit row structure — what the drag-and-drop editor produces and what
 *  the AI designer returns. The user has full control over which photos
 *  share a row. */
export interface ExplicitRow {
  photos: Array<{ url: string; size: Size }>;
}

export interface ExplicitLayout {
  rows: ExplicitRow[];
}

/* ---------------------- Template-based layout ---------------------- */

import type { Template } from "./templates";

/** Lay out photos according to a row partition template. Rows are packed at
 *  their target heights; if the total exceeds the page's vertical budget,
 *  every row is scaled down proportionally so each tile keeps its aspect
 *  (no cropping) and the page still fits. */
export function layoutTemplate(
  template: Template,
  photos: Array<{ url: string; aspect: number }>,
  pageW: number = PAGE_W,
  budget: number = PAGE_BUDGET
): Row[] {
  let cursor = 0;
  const rows: Row[] = [];
  for (const n of template.rows) {
    const rowPhotos = photos.slice(cursor, cursor + n);
    if (rowPhotos.length === 0) continue;
    rows.push(
      packRow(
        rowPhotos.map((p) => ({ url: p.url, aspect: p.aspect, size: "M" as Size })),
        targetHeightForRowSize(n),
        pageW
      )
    );
    cursor += n;
  }
  // Budget enforcement: scale all rows together if the total page height
  // would overflow. Scaling height AND widthPct by the same factor keeps
  // every tile's aspect = photo aspect (so no cropping kicks in).
  const total = rows.reduce((s, r) => s + r.height, 0);
  if (total > budget) {
    const scale = budget / total;
    return rows.map((r) => ({
      height: r.height * scale,
      photos: r.photos.map((p) => ({ ...p, widthPct: p.widthPct * scale })),
    }));
  }
  return rows;
}

/** Whether this template is practical for these photos. Filters templates
 *  where a single row's natural height would be unreasonably large (e.g. a
 *  solo portrait row that would otherwise overwhelm the page). */
export function templateFits(
  template: Template,
  photos: Array<{ url: string; aspect: number }>,
  pageW: number = PAGE_W
): boolean {
  if (photos.length !== template.count) return false;
  let cursor = 0;
  for (const n of template.rows) {
    const rowPhotos = photos.slice(cursor, cursor + n);
    if (rowPhotos.length === 0) return false;
    const targetH = targetHeightForRowSize(n);
    const totalNatW = rowPhotos.reduce((s, p) => s + targetH * p.aspect, 0);
    const actualH = targetH * (pageW / totalNatW);
    if (actualH > MAX_SINGLE_ROW_H) return false;
    cursor += n;
  }
  return true;
}

/** Lay out an explicit row structure. Each row uses the largest size in
 *  the row as its target height (so a row with one L + one M gets L
 *  height); single-photo rows use that photo's size directly. */
export function layoutGalleryExplicit(
  layout: ExplicitLayout,
  aspectByUrl: Record<string, number>,
  pageW: number = PAGE_W
): Row[] {
  const SIZE_RANK: Record<Size, number> = { S: 0, M: 1, L: 2 };
  return layout.rows
    .filter((r) => r.photos.length > 0)
    .map((r) => {
      // Target height = largest size in the row.
      const maxSize = r.photos.reduce<Size>(
        (acc, p) => (SIZE_RANK[p.size] > SIZE_RANK[acc] ? p.size : acc),
        "S"
      );
      const targetH = SIZE_HEIGHT[maxSize];
      const inputs: PhotoInput[] = r.photos.map((p) => ({
        url: p.url,
        aspect: aspectByUrl[p.url] ?? 1.0,
        size: p.size,
      }));
      return packRow(inputs, targetH, pageW);
    });
}

/** The layout engine. Takes a list of photos with sizes + a variant, returns
 *  the rows the renderer should emit. */
export function layoutGallery(
  photos: PhotoInput[],
  variant: Variant,
  pageW: number = PAGE_W
): Row[] {
  if (photos.length === 0) return [];

  if (variant === "stacked") {
    // Group ALL photos of the same size into one row each (L row, then M
    // row, then S row). Within each row, photos preserve the user's order.
    // This guarantees at most 3 rows regardless of sizing pattern — even
    // when sizes alternate like [L, M, S, M, S] we get 3 clean rows instead
    // of 5 isolated lines.
    const rows: Row[] = [];
    for (const size of ["L", "M", "S"] as const) {
      const group = photos.filter((p) => p.size === size);
      if (group.length > 0) {
        rows.push(packRow(group, SIZE_HEIGHT[size], pageW));
      }
    }
    return rows;
  }

  if (variant === "hero") {
    // Find the L photo (or fall back to the first photo). Put it on its
    // own row at L height. Everything else packs into one row beneath at
    // M height.
    let heroIdx = photos.findIndex((p) => p.size === "L");
    if (heroIdx < 0) heroIdx = 0;
    const hero = photos[heroIdx];
    const rest = photos.filter((_, i) => i !== heroIdx);
    const rows: Row[] = [packRow([hero], SIZE_HEIGHT.L, pageW)];
    if (rest.length > 0) {
      rows.push(packRow(rest, SIZE_HEIGHT.M, pageW));
    }
    return rows;
  }

  // "compact" — everything at M height, split into ≤2 rows so the page
  // stays compact.
  if (photos.length <= 3) {
    return [packRow(photos, SIZE_HEIGHT.M, pageW)];
  }
  const mid = Math.ceil(photos.length / 2);
  return [
    packRow(photos.slice(0, mid), SIZE_HEIGHT.M, pageW),
    packRow(photos.slice(mid), SIZE_HEIGHT.M, pageW),
  ];
}

/* ---------------------- Shape helpers (UI only) ---------------------- */

export type Shape = "landscape" | "portrait" | "square" | "unknown";

export function classifyShape(aspect: number | undefined): Shape {
  if (!aspect || !isFinite(aspect)) return "unknown";
  if (aspect > 1.10) return "landscape";
  if (aspect < 0.90) return "portrait";
  return "square";
}

/** Suggest a default size for a photo based on its shape + lead position. */
export function suggestSize(
  aspect: number | undefined,
  indexInOrder: number
): Size {
  const shape = classifyShape(aspect);
  if (indexInOrder === 0 && shape === "landscape") return "L";
  if (indexInOrder === 0) return "M";
  if (shape === "landscape") return "M";
  return "S";
}

/** Hard rule: at most one Large per gallery (matches the editor's UX). */
export function enforceMaxOneLarge(sizes: Size[]): Size[] {
  let seenL = false;
  return sizes.map((s) => {
    if (s === "L") {
      if (seenL) return "M";
      seenL = true;
    }
    return s;
  });
}
