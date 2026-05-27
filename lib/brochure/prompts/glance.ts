// Page 2 — At a glance. Claude fills 5 editorial slots:
//   headline      — the big serif statement (e.g. "An acre, held freehold.")
//   priceTagline  — short subline under the price (e.g. "Two plots · sold together")
//   blurb         — 1 sentence (~30 words) beside the price
//   bodyPara1     — opening paragraph of "the shortest description"
//   bodyPara2     — optional follow-on paragraph (empty string if not needed)

import type { PropertyRecord } from "@/lib/repo/properties";

export const GLANCE_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA, a private luxury real-
estate practice in Kenya. You are writing page 2 — "At a Glance" — of a
printed property brochure handed to a short-listed buyer.

VOICE
- Restrained, sparing, slightly literary. British-English spelling.
- Short sentences. Strong verbs. No marketing clichés
  (NEVER: luxurious, stunning, must-see, breathtaking, perfect, dream,
   immaculate, exquisite, gem, oasis, sanctuary).
- Italics used sparingly for accent via <em> in headlines.

HARD RULES
- NEVER invent facts. Only use what's in the property data supplied.
- If a fact isn't in the data, do not allude to it.
- bodyPara2 may be empty ("") if you've already said enough in bodyPara1.

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

const GLANCE_EXAMPLE = `
EXAMPLE — Rosslyn Lone Tree (two adjacent 0.5-acre plots in Nairobi,
KES 145M, mature gardens):
  headline:     "An acre, held <em>freehold</em>."
  priceTagline: "Two plots · sold together"
  blurb:        "A rare, ready-assembled acre on the quiet side of Rosslyn — already softened by decades of garden, and offered as one parcel to a single buyer."
  bodyPara1:    "Rosslyn Lone Tree is a one-acre garden parcel made of two adjoining freehold plots, laid side by side to form a clean rectangular acre. The land sits off Rosslyn Close in northern Nairobi, screened from the road by mature trees and softened underfoot by years of low-key planting — heliconia, bamboo, traveller's palm, indigenous canopy."
  bodyPara2:    "It is offered as a single assemblage. The two titles can be developed jointly as one estate residence with generous setbacks, or kept as a pair — one to live on, one to hold. Either way, the work of waiting for a Nairobi garden to grow has already been done."
`.trim();

export function buildGlanceUserPrompt(p: PropertyRecord): string {
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
  add("Year built", p.yearBuilt);
  add("Year restored", p.yearRestored);
  add("Tenure", p.tenure);
  add("Shape", p.shape);
  add("Site condition", p.siteCondition);
  add("Sale terms", p.saleTerms);
  add("Highlights", p.highlights);
  add("Amenities", p.amenities);
  add("Description (owner's own words)", p.description);

  return [
    GLANCE_EXAMPLE,
    "",
    "NOW WRITE PAGE 2 FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "headline: the defining one-line statement about the property.",
    "priceTagline: 3-6 words under the asking number.",
    "blurb: 1 sentence (~30 words) anchored in real facts.",
    "bodyPara1: 2-4 sentences (~60-90 words) telling the property's story.",
    "bodyPara2: 2-3 sentences ONLY if there's a second movement worth making; else \"\".",
  ].join("\n");
}

export const GLANCE_TOOL = {
  name: "fill_glance",
  description: "Submit the page-2 'at a glance' copy. ALL fields required (bodyPara2 may be empty).",
  input_schema: {
    type: "object" as const,
    properties: {
      headline:     { type: "string", description: "Big serif statement, <em> allowed (≤8 words)." },
      priceTagline: { type: "string", description: "3-6 words under the price." },
      blurb:        { type: "string", description: "1 sentence, ~30 words." },
      bodyPara1:    { type: "string", description: "2-4 sentences, ~60-90 words." },
      bodyPara2:    { type: "string", description: "2-3 sentences OR empty string." },
    },
    required: ["headline", "priceTagline", "blurb", "bodyPara1", "bodyPara2"],
    additionalProperties: false,
  },
};
