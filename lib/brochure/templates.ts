// Hand-curated gallery templates for page 5. Each template is just a row
// partition (how many photos in each row). The actual tile dimensions are
// computed from the photos' aspect ratios — so tiles ALWAYS match photo
// shapes (no cropping, no letterboxing).
//
// DESIGN CONSTRAINT: every row contains exactly 2 photos (a "pair") or
// exactly 3 photos (a "trio"). No single-photo rows (heroes), no rows of
// 4+ (strips). This keeps every layout balanced and editorial.
//
// 2-ROW HARD CAP: gallery is 2 rows MAX. 3-row layouts were tried and
// felt cramped — photos shrink to the point that nothing carries. The
// densest layout is now 6-trio-trio (6 photos in 2 rows). For brochures
// with more photos than 6 + cover (7 total), use the page-3 photo-essay
// variant to absorb 3 more — then gallery can show 5 more for a 1+3+5=9
// "every photo shown" outcome. The PropertyForm + brochure editor
// surface this math.
//
// A template requires exactly `count` photos. The user picks one of the
// fitting templates for her photo count; photos fill slots in upload
// order (which she controls via the photo grid in the property form).

export interface Template {
  id: string;
  /** Number of photos this template needs (gallery photo count). */
  count: number;
  /** Photos per row, in order. e.g. [2, 3] = pair on top + trio below. */
  rows: number[];
  /** Display name in the picker. */
  label: string;
  /** One-line explanation. */
  blurb: string;
}

export const TEMPLATES: Template[] = [
  // 1 photo (only option — preserved so the page renders for thin galleries)
  { id: "1-single", count: 1, rows: [1], label: "Single", blurb: "One full photo." },

  // 2 photos — one pair
  { id: "2-pair", count: 2, rows: [2], label: "Pair", blurb: "Two photos side by side." },

  // 3 photos — one trio
  { id: "3-trio", count: 3, rows: [3], label: "Trio", blurb: "Three photos in a single row." },

  // 4 photos — two pairs
  { id: "4-pair-pair", count: 4, rows: [2, 2], label: "Pair + pair", blurb: "Two rows of two photos each." },

  // 5 photos — pair + trio (the two combinations)
  { id: "5-pair-trio", count: 5, rows: [2, 3], label: "Pair + trio", blurb: "Pair on top, trio below." },
  { id: "5-trio-pair", count: 5, rows: [3, 2], label: "Trio + pair", blurb: "Trio on top, pair below." },

  // 6 photos — two trios (the densest 2-row option)
  { id: "6-trio-trio", count: 6, rows: [3, 3], label: "Trio + trio", blurb: "Two rows of three photos." },
  // 3-row templates (6-pair-pair-pair, 7-pair-pair-trio, 7-pair-trio-pair,
  // 7-trio-pair-pair) were intentionally removed — page 5 is now capped
  // at 2 rows for editorial reasons (denser layouts shrunk photos to the
  // point of being unreadable).
];

/** All templates that exactly match the given photo count. */
export function templatesForCount(n: number): Template[] {
  return TEMPLATES.filter((t) => t.count === n);
}

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
