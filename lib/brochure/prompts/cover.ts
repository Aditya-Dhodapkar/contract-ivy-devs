// Page 1 — Cover. Page-scoped Claude prompt + tool schema.
// Smaller scope than the monolithic prompt: fewer slots, sharper few-shots,
// lower token budget. Claude fills out a 3-field "config form" specifically
// for the cover.

import type { PropertyRecord } from "@/lib/repo/properties";

export const COVER_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA, a private luxury real-
estate practice in Kenya. You are writing ONLY the cover of a printed
property brochure — the first thing a buyer sees.

VOICE
- Restrained, sparing, slightly literary. British-English spelling.
- Short sentences. Strong verbs. No marketing clichés
  (NEVER: luxurious, stunning, must-see, breathtaking, perfect, dream,
   immaculate, exquisite, gem).
- Italics used sparingly for accent (e.g. "<em>privately</em> sold").

HARD RULES
- NEVER invent facts. Only use what's in the property data supplied.
- If a fact isn't in the data, do not allude to it.

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

const COVER_EXAMPLE = `
EXAMPLE — Rosslyn Lone Tree (two adjacent 0.5-acre plots near Karura
Forest, Nairobi; offered as a single one-acre lot, KES 145M):
  eyebrow: "A One-Acre Garden Parcel"
  title:   "Rosslyn<br/><em>Lone&nbsp;Tree</em>"
  sub:     "Two adjoining freehold plots wrapped in mature tropical foliage, set quietly off Rosslyn Close beside the One Off Gallery — in one of Nairobi's most established diplomatic addresses."
`.trim();

export function buildCoverUserPrompt(p: PropertyRecord): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };

  add("Title", p.title);
  add("Reference", p.referenceNumber);
  add("Location", [p.city, p.country].filter(Boolean).join(", "));
  add("Type", p.propertyType);
  add("Price (KES)", p.price);
  add("Plot size", p.plotSize);
  add("Built area", p.builtArea);
  add("Bedrooms", p.bedrooms);
  add("Bathrooms", p.bathrooms);
  add("Highlights", p.highlights);
  add("Amenities", p.amenities);
  add("Description (owner's own words)", p.description);

  return [
    COVER_EXAMPLE,
    "",
    "NOW WRITE THE COVER FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "Pick the single defining quality of THIS property for the eyebrow.",
    "The title is the property's name — wrap it in 1-2 lines using <br/>",
    "and apply <em> to the most evocative word(s).",
    "The sub is one sentence (~30-50 words) anchored in facts above.",
  ].join("\n");
}

export const COVER_TOOL = {
  name: "fill_cover",
  description: "Submit the cover copy for the brochure. ALL fields required.",
  input_schema: {
    type: "object" as const,
    properties: {
      eyebrow: { type: "string", description: "3-6 words; the defining quality of the property." },
      title:   { type: "string", description: "MAX 6 words / 50 chars (must fit ≤2 lines at 96pt serif). <br/> + <em> allowed." },
      sub:     { type: "string", description: "~30-50 words, magazine voice, anchored in supplied facts." },
    },
    required: ["eyebrow", "title", "sub"],
    additionalProperties: false,
  },
};
