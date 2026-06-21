// Owner-facing description drafter. Lives outside the brochure-page
// prompts because it serves the PropertyForm directly: the owner clicks
// "Let AI draft this" next to the description field and Claude returns
// 80-120 words of SANSI-voice prose built from the rest of the form data
// (location, type, bedrooms, plot, year built, highlights, nearby, etc.).
//
// The output is plain prose — no HTML, no <em> tags, no markdown — so the
// existing textarea can render it as-is and the owner can edit any word.

import type { PropertyRecord } from "@/lib/repo/properties";

export const DESCRIPTION_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA. You are drafting the
"description" paragraph for a luxury property listing. This text is what
the owner would write themselves if they had the time — it ends up in the
listing UI, the brochure prompts, and downstream PDF copy.

VOICE
- Restrained, slightly literary. British-English spelling.
- Reads as an editorial paragraph from a property quarterly — confident,
  specific, never breathless.
- 80 to 120 words. Three short paragraphs OR one continuous paragraph; do
  not exceed 120.
- Plain prose. NO HTML, NO <em> tags, NO markdown, NO bullet lists.
- No clichés (NEVER: luxurious, stunning, must see, breathtaking, perfect,
  dream, immaculate, exquisite, gem, oasis, sanctuary, hidden gem, dream
  home, lifestyle, lifestyle property, idyllic).

WHAT TO INCLUDE
- The setting in one line — coast, hillside, town or countryside, the
  country or region.
- What the property is, structurally — bedrooms, build era if known,
  notable architectural language ("coral and lime walls", "open plan",
  "single storey", etc., only if the data supports it).
- One specific quality buyer would care about — sun aspect, views, water
  access, garden, terrace, restoration scope, privacy.
- Title status and access (freehold, leasehold or right of use), if
  supplied.

HARD RULES
- NEVER use a hyphen or dash of any kind anywhere in the description
  (no "-", no "–", no "—"). Do not use hyphenated compound words: write
  them as separate words ("single storey", "open plan", "sea facing") or
  choose a different word. Write ranges and numbers in words ("80 to 120",
  "two to three"), never with a hyphen.
- Never invent facts. If a field is empty, write around it.
- Do not name the title (e.g. "Villa Tao Bay") — the listing card already
  shows it.
- Do not use the property's price, even if supplied.
- Do not write a tagline or single-line description; this is paragraph
  copy.

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

export function buildDescriptionUserPrompt(p: Partial<PropertyRecord>): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  // Note: title is given for context only; the prompt says not to name it.
  add("Title (context only — do NOT name)", p.title);
  add("Type", p.propertyType);
  add("City", p.city);
  add("Country", p.country);
  add("Bedrooms", p.bedrooms);
  add("Bathrooms", p.bathrooms);
  add("Plot size", p.plotSize);
  add("Built area", p.builtArea);
  add("Facing direction", p.facingDirection);
  add("Year built", p.yearBuilt);
  add("Year restored", p.yearRestored);
  add("Restoration notes", p.restorationNotes);
  add("Tenure", p.tenure);
  add("Highlights", p.highlights);
  add("Site condition", p.siteCondition);
  if (p.nearby?.length) {
    add(
      "Nearby",
      p.nearby
        .filter((n) => n.place || n.distance)
        .map((n) => `${n.place} (${n.distance})`)
        .join("; ")
    );
  }

  return [
    "WRITE THE DESCRIPTION FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "description: 80 to 120 words. Plain prose. Editorial voice. No HTML. No hyphens or dashes anywhere.",
  ].join("\n");
}

export const DESCRIPTION_TOOL = {
  name: "fill_description",
  description: "Submit the property description.",
  input_schema: {
    type: "object" as const,
    properties: {
      description: {
        type: "string",
        description:
          "80 to 120 word editorial description. Plain prose only. No hyphens or dashes anywhere.",
      },
    },
    required: ["description"],
    additionalProperties: false,
  },
};
