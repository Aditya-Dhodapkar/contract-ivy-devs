// Page 5 — Gallery / "On the ground". Claude fills 2 slots:
//   headline — eyebrow-anchor headline above the photo mosaic
//   intro    — 30-60 word editorial paragraph, property-aware
// The photos and their captions are pure data — entered by the owner.

import type { PropertyRecord } from "@/lib/repo/properties";

export const FEATURE_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA, a private luxury real-
estate practice in Kenya. You are writing ONLY the page-5 (gallery) copy.

The page is titled "§ IV — On the ground". It carries a series of photos
of the property as it actually looks today. Your headline and intro lead
the reader into those photographs.

VOICE
- Restrained, sparing, slightly literary. British-English spelling.
- Headline: 4-8 words. <em> tags allowed for emphasis on one word.
- Intro: 30-60 words. Reads as the editor's note before a photo essay.
- No marketing clichés (NEVER: luxurious, stunning, must-see, breathtaking,
  perfect, dream, immaculate, exquisite, oasis).
- Speak about what the photos show — the land, the light, the garden, the
  building, whatever the property leads with. Don't list specs.

HARD RULES
- NEVER invent facts. Only use what's in the property data supplied.
- Don't reference photo numbers or directions you can't verify.
- Don't promise interiors if the property is land; don't describe gardens
  if it's an apartment.

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

const FEATURE_EXAMPLE = `
EXAMPLE — Rosslyn Lone Tree (1 acre, mature garden, vacant land):
  headline: "A garden, <em>already grown in</em>."
  intro: "The land photographs as a garden, not a building site. Mature traveller's palms, bamboo screens, heliconia and indigenous canopy — the kind of setting that takes a decade to make and an afternoon to fall for."

EXAMPLE — Beachfront restored villa (4 beds, Lamu, sea-facing):
  headline: "Coral walls, <em>open windows</em>."
  intro: "The house wears its restoration lightly. Coral-rag walls, lime-washed and shaded by mature neem, hold the rooms cool through the afternoons. From the upper terrace the dhow channel is plainly visible — a working sea, not a postcard."
`.trim();

export function buildFeatureUserPrompt(p: PropertyRecord): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  add("Title", p.title);
  add("City", p.city);
  add("Type", p.propertyType);
  add("Plot size", p.plotSize);
  add("Built area", p.builtArea);
  add("Bedrooms", p.bedrooms);
  add("Year built", p.yearBuilt);
  add("Highlights", p.highlights);
  add("Amenities", p.amenities);
  add("Site condition", p.siteCondition);
  add("Description", p.description);

  // If the owner wrote captions, surface them — they're the closest thing
  // to ground-truth about what the photos actually show.
  const captions = (p.photoCaptions ?? []).filter((c) => c && c.trim());
  if (captions.length) lines.push(`Photo captions: ${captions.join(" | ")}`);

  return [
    FEATURE_EXAMPLE,
    "",
    "NOW WRITE THE PAGE-5 HEADLINE AND INTRO FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "Headline: 4-8 words, <em> on one word. Intro: 30-60 words, editor's-note voice.",
  ].join("\n");
}

export const FEATURE_TOOL = {
  name: "fill_feature",
  description: "Submit the page-5 gallery copy. Both fields required.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string", description: "4-8 words; <em> allowed." },
      intro: { type: "string", description: "30-60 word editor's-note paragraph." },
    },
    required: ["headline", "intro"],
    additionalProperties: false,
  },
};
