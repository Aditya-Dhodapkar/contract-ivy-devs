// Page 3 (alternative) — "Photo essay". Three large photo + caption blocks
// arranged as a magazine spread. Each block has a section label, a serif
// headline, and a 50-70 word editorial caption. Photos used = the first
// three gallery photos (photos[1..3]); page 5 still uses the full gallery.

import type { PropertyRecord } from "@/lib/repo/properties";

export const PHOTO_ESSAY_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA. You are writing the
captions for a 3-photo editorial spread on page 3 of a luxury property
brochure. Each caption pairs with one specific photograph.

You will not see the photographs themselves. Use the property data,
photo captions (if provided), and the photo's position (1, 2, 3) to
write captions that could plausibly accompany each shot.

VOICE
- Restrained, sparing, slightly literary. British-English spelling.
- Headline (per fig): ≤6 words / 50 chars, <em> allowed for one word.
- Label (per fig): 1-2 words, the *kind* of shot it is (e.g. "Threshold",
  "Interior", "Pool deck", "Garden path", "Hallway"). Used as a small
  caption above the headline.
- Body (per fig): 50-70 words. One paragraph. Editor's-note voice — what
  the shot shows, what it means, what the eye should notice.
- Page headline (top of page): ≤6 words / 50 chars. <em>+<br/> allowed.
- No clichés (NEVER: luxurious, stunning, must-see, breathtaking, perfect,
  dream, immaculate, exquisite, gem, oasis).

HIGHLIGHT WORDS
- In each fig body, wrap 2-3 key nouns in <em> tags. Materials, qualities,
  specific named things. Never prepositions or articles.

HARD RULES
- NEVER invent specifics (specific materials, brands, named architects)
  unless they're in the data. If you say "linen drapes" or "lime plaster"
  it must be plausibly inferrable from description / highlights / amenities.
- If photo captions are provided in the data, treat them as ground-truth
  about what each photo shows.

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

export function buildPhotoEssayUserPrompt(p: PropertyRecord): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  add("Title", p.title);
  add("City", p.city);
  add("Type", p.propertyType);
  add("Highlights", p.highlights);
  add("Amenities", p.amenities);
  add("Site condition", p.siteCondition);
  add("Description", p.description);

  // Surface captions for photos 1-3 if available (cover is photos[0];
  // essay uses photos[1..3] so caption indices are 1, 2, 3).
  const captions = p.photoCaptions ?? [];
  for (let i = 1; i <= 3; i++) {
    const c = captions[i]?.trim();
    if (c) lines.push(`Photo ${i} caption: ${c}`);
  }

  return [
    "WRITE A 3-PHOTO EDITORIAL SPREAD FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "Page headline: MAX 6 words / 50 chars.",
    "For each Fig (1, 2, 3): a 1-2 word label, a ≤6-word headline,",
    "and a 50-70 word body. Wrap 2-3 nouns per body in <em>.",
  ].join("\n");
}

export const PHOTO_ESSAY_TOOL = {
  name: "fill_photo_essay",
  description: "Submit the page-3 (photo essay) copy. All fields required.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string", description: "Page headline, ≤6 words / 50 chars." },
      fig1Label: { type: "string", description: "1-2 words, kind of shot." },
      fig1Headline: { type: "string", description: "≤6 words; <em> on one word." },
      fig1Body: { type: "string", description: "50-70 word caption. 2-3 <em> highlights." },
      fig2Label: { type: "string" },
      fig2Headline: { type: "string" },
      fig2Body: { type: "string" },
      fig3Label: { type: "string" },
      fig3Headline: { type: "string" },
      fig3Body: { type: "string" },
    },
    required: [
      "headline",
      "fig1Label", "fig1Headline", "fig1Body",
      "fig2Label", "fig2Headline", "fig2Body",
      "fig3Label", "fig3Headline", "fig3Body",
    ],
    additionalProperties: false,
  },
};
