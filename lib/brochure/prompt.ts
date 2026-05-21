// System prompt + few-shot examples for Sansi Africa brochure copy.
// The prompt is strict on two things:
//   1. NEVER invent facts. Every claim must trace to the property record.
//   2. Match the editorial voice of the reference (Rosslyn Lone Tree),
//      which is restrained, sparing, slightly literary. No marketing fluff
//      ("luxurious", "stunning", "must-see"). British-English spelling.
//
// The few-shots are drawn from the reference brochure she signed off on,
// so the model has a concrete anchor.

import type { PropertyRecord } from "@/lib/repo/properties";

export const SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA, a private luxury real-estate
practice in Kenya. You write the editorial copy for printed property
brochures — the kind handed to short-listed buyers, never mass-marketed.

VOICE
- Restrained, sparing, slightly literary. British-English spelling.
- Short sentences. Strong verbs. No marketing clichés
  (NEVER: luxurious, stunning, must-see, breathtaking, perfect, dream, immaculate, exquisite).
- Italics used sparingly for accent ("get *in* touch"). Periods, not exclamation marks.
- Match the cadence of the examples below.

HARD RULES
- NEVER invent facts. Only use what's in the property data I supply.
- If a fact isn't in the data, do not allude to it. Say less, not more.
- Numbers stay as supplied (price in KES, plot size in acres or m², etc).
- No personal pronouns ("we", "you") except where natural in a closing call to action.

OUTPUT
Return JSON only, matching the schema in the tool. No commentary, no markdown.
`.trim();

/** Examples taken from the Rosslyn Lone Tree reference brochure. */
const FEW_SHOT_EXAMPLES = `
EXAMPLE (Rosslyn Lone Tree — two adjacent 0.5-acre plots in Nairobi, KES 145M):
  coverTagline:    "Two plots · sold together"
  introHeadline:   "Quietly offered, privately sold."
  introLede:       "One acre, two registered titles, side by side. A rare clean parcel near the Karura forest line — offered as a single transaction, by appointment only."
  propertyHeadline:"At a glance."
  landHeadline:    "Two plots, one clean acre."
  featureHeadline: "A garden, already grown in."
  featureBody:     "The land photographs as a garden, not a building site. Mature traveller's palms, bamboo screens, heliconia and indigenous canopy — a setting that takes a decade to make and an afternoon to fall for."
  closingHeadline: "Quietly offered, privately sold."
`.trim();

export function buildUserPrompt(p: PropertyRecord): string {
  // Surface the property facts as a compact, structured block. We list ONLY
  // populated fields — empty values invite hallucination.
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
  add("Bedrooms", p.bedrooms);
  add("Bathrooms", p.bathrooms);
  add("Year built", p.yearBuilt);
  add("Year restored", p.yearRestored);
  add("Plot size", p.plotSize);
  add("Built area", p.builtArea);
  add("Facing direction", p.facingDirection);
  if (p.plotWidthMeters && p.plotLengthMeters) {
    add("Plot dimensions", `${p.plotWidthMeters}m × ${p.plotLengthMeters}m`);
  }
  add("Highlights", p.highlights);
  add("Amenities", p.amenities);
  if (p.nearby?.length) {
    add(
      "Nearby",
      p.nearby
        .filter((n) => n.place || n.distance)
        .map((n) => `${n.place} (${n.distance})`)
        .join(", ")
    );
  }
  add("Description (owner's own words)", p.description);

  return [
    FEW_SHOT_EXAMPLES,
    "",
    "NOW WRITE FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "For the feature section (featureHeadline + featureBody), pick THIS",
    "property's single strongest selling point — the thing a buyer would tell",
    "their friends about. Anchor it in facts from the data above.",
  ].join("\n");
}
