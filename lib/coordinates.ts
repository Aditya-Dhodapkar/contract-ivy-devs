// Pure coordinate-pair parsing for the property form's lat/lng paste UX
// (Phase 3 — see error_handling.md §3.2 / M2). The two coordinate inputs are
// `type=number`, so pasting a "lat, lng" pair (the natural thing a user copies
// from Google Maps) would otherwise be dropped. PropertyForm's onPaste handler
// runs this and, when it recognises a pair, fills both fields itself.
//
// Dependency-free so it's importable by the "use client" form and the pure
// strip-types test runner alike. Bounds match lib/validation/property.ts so the
// client and server agree (latitude ∈ [-90,90], longitude ∈ [-180,180]).

export type CoordinatePairResult =
  | { lat: number; lng: number }
  | { error: string }
  | null;

/** Parse a pasted "lat, lng" string.
 *
 *  - Returns `{ lat, lng }` when the text is two finite, in-range numbers
 *    separated by a comma and/or whitespace (e.g. "-1.2163, 36.7928",
 *    "-1.2163 36.7928", "-1.2163,36.7928").
 *  - Returns `{ error }` when it *is* a recognisable pair but a value is
 *    out of the valid geographic range — so the form can explain it.
 *  - Returns `null` when the text isn't a coordinate pair at all (a single
 *    number, prose, three values, …) so the caller lets the normal paste
 *    proceed untouched. */
export function parseCoordinatePair(text: string): CoordinatePairResult {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Split on a comma (with optional surrounding spaces) or on whitespace.
  const parts = trimmed.split(/\s*,\s*|\s+/).filter(Boolean);
  if (parts.length !== 2) return null; // not a clean pair — leave paste alone

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      error:
        "Those coordinates look off — latitude must be between -90 and 90, and longitude between -180 and 180.",
    };
  }
  return { lat, lng };
}
