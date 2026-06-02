// Photo budget allocator — the SINGLE source of truth for which property
// photo lands on which brochure page.
//
// Why this exists:
//   Before this helper, each brochure route + the assembler each computed
//   their own slice of `property.photos` (photos[0] for cover, photos[1..3]
//   for photo-essay, photos[1..7] for the gallery, photos[1] for
//   provenance inset, etc.) with inline conditionals. Every time we added
//   a new page or page-3 variant we had to remember to update the gallery
//   slice in the route. The slices silently overlapped, and the same shot
//   would appear on page 3 AND page 5.
//
// The rule (from testing-brochure.txt):
//   - photos[0] is the hero / cover. May appear on page 1 only (and
//     optionally the closing page, if we add that toggle).
//   - Every other photo appears at MOST ONCE across the brochure.
//   - When a page-3 variant consumes specific photos, those photos are
//     removed from the page-5 gallery pool.
//
// How to use:
//   const alloc = allocatePhotos(property, { page3Variant, galleryRowCount });
//   // alloc.coverUrl              — page 1
//   // alloc.page3PhotoUrls        — page 3 (photo-essay variant only)
//   // alloc.provenancePhotoUrl    — page 3 (provenance variant inset)
//   // alloc.galleryUrls           — page 5
//   // alloc.galleryCaptionIndices — matches galleryUrls, for caption lookup
//
// Explicit user overrides (drag-and-drop reordering, AI designer output)
// bypass the no-reuse filter because the user has chosen a layout
// deliberately. Auto-mode (no explicit input) enforces the rule.

import type { PropertyRecord } from "@/lib/repo/properties";
import type { Page3Variant } from "./types";
import type { ExplicitLayout } from "./gallery-layout";

export interface PhotoAllocation {
  /** photos[0] — the brochure cover. Empty when no photos OR cover is
   *  landscape (cover would crop badly into the portrait A4 face — the
   *  brochure falls back to a forest-green panel). */
  coverUrl: string;
  /** Photo URLs for the page-3 photo-essay variant (3 shots). Empty for
   *  any other page-3 variant. */
  page3PhotoUrls: string[];
  /** Single photo URL for the page-3 provenance inset. Undefined for any
   *  other page-3 variant. */
  provenancePhotoUrl?: string;
  /** Page-5 gallery photo URLs, in display order, deduped against any
   *  photos consumed by the page-3 variant. */
  galleryUrls: string[];
  /** Indices into property.photos, aligned with galleryUrls. The
   *  assembler uses these to look up the right photoCaption[] entry. */
  galleryCaptionIndices: number[];
}

export interface AllocateOptions {
  page3Variant: Page3Variant;
  /** Cover guard: when true, photos[0] is rejected as a cover (the brochure
   *  falls back to a vignette panel) but the photo can still appear in the
   *  gallery. The route classifies this before calling us. */
  coverIsLandscape?: boolean;
  /** Editor drag-and-drop layout. When supplied, bypasses no-reuse
   *  filtering — the user has chosen explicitly. */
  explicitGalleryLayout?: ExplicitLayout;
  /** Linear ordering of gallery photos by URL. Same bypass semantics as
   *  explicitGalleryLayout. */
  explicitGalleryOrder?: string[];
}

// Page 5 gallery is capped at 2 rows. The densest 2-row template
// (6-trio-trio) takes 6 photos, so 6 is the hard ceiling. Below that we
// take whatever's left after the cover + page-3 reservations — every
// uploaded photo should appear somewhere in the brochure when possible.
const GALLERY_MAX = 6;

export function allocatePhotos(
  property: PropertyRecord,
  opts: AllocateOptions
): PhotoAllocation {
  const allPhotos = property.photos ?? [];

  // --- Cover ---
  const coverUrl = opts.coverIsLandscape ? "" : (allPhotos[0] ?? "");

  // --- Page 3 photo(s) ---
  let page3PhotoUrls: string[] = [];
  let provenancePhotoUrl: string | undefined;
  if (opts.page3Variant === "photo-essay") {
    page3PhotoUrls = allPhotos.slice(1, 4);
  } else if (opts.page3Variant === "provenance") {
    provenancePhotoUrl = allPhotos[1];
  }

  // --- Reserved indices (must NOT appear in gallery in auto mode) ---
  // Cover is always reserved. Page-3 photos are reserved per-variant.
  const reservedIndices = new Set<number>();
  if (allPhotos[0] != null) reservedIndices.add(0);
  if (opts.page3Variant === "photo-essay") {
    for (let i = 1; i <= 3 && i < allPhotos.length; i++) reservedIndices.add(i);
  } else if (opts.page3Variant === "provenance" && allPhotos[1] != null) {
    reservedIndices.add(1);
  }

  // --- Gallery selection ---
  // Gallery target: take ALL remaining photos (after the cover + page-3
  // reservations) up to the GALLERY_MAX hard cap (6 = densest 2-row
  // template). For an owner who uploaded 9 photos and picked the
  // photo-essay variant, this gives cover(1) + essay(3) + gallery(5) = 9
  // shown, all unique. Without essay, max shown is 1 + 6 = 7; extra
  // uploads remain on the property but don't appear in the brochure
  // (the editor surfaces this — "X of Y shown").
  const reservedCount = reservedIndices.size;
  const remaining = Math.max(0, allPhotos.length - reservedCount);
  const galleryTarget = Math.min(GALLERY_MAX, remaining);

  // Explicit selections (drag-and-drop OR AI designer) bypass the
  // no-reuse filter: if the user deliberately placed a photo there,
  // honour it even if it overlaps with page 3.
  const galleryUrls: string[] = [];
  const galleryCaptionIndices: number[] = [];

  if (opts.explicitGalleryLayout) {
    const seen = new Set<string>();
    for (const row of opts.explicitGalleryLayout.rows) {
      for (const p of row.photos) {
        if (seen.has(p.url)) continue;
        const idx = allPhotos.indexOf(p.url);
        if (idx >= 0) {
          galleryUrls.push(p.url);
          galleryCaptionIndices.push(idx);
          seen.add(p.url);
        }
      }
    }
  } else if (opts.explicitGalleryOrder && opts.explicitGalleryOrder.length > 0) {
    for (const url of opts.explicitGalleryOrder.slice(0, galleryTarget)) {
      const idx = allPhotos.indexOf(url);
      if (idx >= 0) {
        galleryUrls.push(url);
        galleryCaptionIndices.push(idx);
      }
    }
  } else {
    // Auto mode: walk all photos in order, skip reserved, stop at target.
    for (let i = 0; i < allPhotos.length && galleryUrls.length < galleryTarget; i++) {
      if (reservedIndices.has(i)) continue;
      galleryUrls.push(allPhotos[i]);
      galleryCaptionIndices.push(i);
    }
  }

  return {
    coverUrl,
    page3PhotoUrls,
    provenancePhotoUrl,
    galleryUrls,
    galleryCaptionIndices,
  };
}
