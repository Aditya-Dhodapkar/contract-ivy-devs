// Hand-curated gallery templates for page 5. Each template is just a row
// partition (how many photos in each row). The actual tile dimensions are
// computed from the photos' aspect ratios — so tiles ALWAYS match photo
// shapes (no cropping, no letterboxing).
//
// A template requires exactly `count` photos. The user picks one of the
// fitting templates for her photo count; photos fill slots in upload order.

export interface Template {
  id: string;
  /** Number of photos this template needs (gallery photo count). */
  count: number;
  /** Photos per row, in order. e.g. [1, 4] = hero row + four-photo row. */
  rows: number[];
  /** Display name in the picker. */
  label: string;
  /** One-line explanation. */
  blurb: string;
}

export const TEMPLATES: Template[] = [
  // 1 photo
  { id: "1-single", count: 1, rows: [1], label: "Single", blurb: "One full photo." },

  // 2 photos
  { id: "2-pair", count: 2, rows: [2], label: "Pair", blurb: "Two photos side by side." },
  { id: "2-stack", count: 2, rows: [1, 1], label: "Stacked", blurb: "One photo on top, one below." },

  // 3 photos
  { id: "3-row", count: 3, rows: [3], label: "Trio", blurb: "Three photos in a single row." },
  { id: "3-hero-pair", count: 3, rows: [1, 2], label: "Hero + pair", blurb: "Featured photo on top, two below." },
  { id: "3-pair-solo", count: 3, rows: [2, 1], label: "Pair + featured", blurb: "Two photos on top, one featured below." },

  // 4 photos (no single-row strip — 4 in a row is too cramped)
  { id: "4-grid", count: 4, rows: [2, 2], label: "Two × two", blurb: "Two rows of two photos each." },
  { id: "4-hero-trio", count: 4, rows: [1, 3], label: "Hero + trio", blurb: "Featured photo on top, three below." },
  { id: "4-trio-solo", count: 4, rows: [3, 1], label: "Trio + featured", blurb: "Three on top, featured photo below." },

  // 5 photos (no single-row strip — 5 in a row is too cramped)
  { id: "5-hero-quartet", count: 5, rows: [1, 4], label: "Hero + four", blurb: "Featured photo on top, four below." },
  { id: "5-pair-trio", count: 5, rows: [2, 3], label: "Pair + trio", blurb: "Two on top, three below." },
  { id: "5-trio-pair", count: 5, rows: [3, 2], label: "Trio + pair", blurb: "Three on top, two below." },
  { id: "5-quartet-solo", count: 5, rows: [4, 1], label: "Quartet + featured", blurb: "Four on top, featured photo below." },
  { id: "5-hero-pair-pair", count: 5, rows: [1, 2, 2], label: "Hero + two pairs", blurb: "Featured photo on top, two pairs below." },
];

/** All templates that exactly match the given photo count. */
export function templatesForCount(n: number): Template[] {
  return TEMPLATES.filter((t) => t.count === n);
}

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
