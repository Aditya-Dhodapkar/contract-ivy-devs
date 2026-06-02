// Page 3 (alternative) — "Provenance". The history of the property:
// built, restored, in-hand. Two-column body text + 4-step timeline.
// Best for restored, historic, or architecturally-significant properties.

import type { PropertyRecord } from "@/lib/repo/properties";

export const PROVENANCE_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA. You are writing page 3
of a luxury property brochure in "Provenance" mode — the history /
heritage of the property: when it was built, its original purpose, when
and how it was restored, and the title status.

Three short paragraphs of body text + values for a 4-step timeline.

VOICE
- Restrained, slightly literary. British-English spelling.
- Reads as a heritage placard — historical, factual, slightly removed.
- Headline: MAX 6 words / 50 chars. <em>+<br/> allowed.
- Para 1: 40-60 words. The build — when, original purpose, materials,
  bones. Tight.
- Para 2: 40-60 words. The restoration — when, who (only if data names
  someone), philosophy, what was kept / changed. Tight.
- Para 3: ONE sentence. A landing — what the property reads as now.
  This is the page's last beat — make it count, but keep it short.
- No clichés (NEVER: luxurious, stunning, must-see, breathtaking, gem,
  oasis, masterpiece, jewel).

HIGHLIGHT WORDS
- Each paragraph: 2-3 <em> highlights on materials, eras, restraint
  details. Never prepositions or articles.

HARD RULES
- NEVER invent specifics. If the data doesn't say "Greek shipping family"
  don't write it. If the data doesn't name the restoration architect,
  don't name one.
- If yearBuilt or yearRestored is missing, write around the gap — focus
  on what is known.
- If "Restoration notes" is supplied in the data, treat it as ground-truth.
  Para 2 must reflect what the owner actually says was restored — not
  general phrases like "interiors comprehensively updated" unless those
  words are in her notes. The restoration-cell caption in the timeline
  should also paraphrase her notes (3-6 words).
- "Originally for" timeline cell: a 2-3 word phrase like "Private use" /
  "Holiday let" / "Single family" — inferrable from description if not
  explicit.

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

export function buildProvenanceUserPrompt(p: PropertyRecord): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  add("Title", p.title);
  add("Type", p.propertyType);
  add("Year built", p.yearBuilt);
  add("Year restored", p.yearRestored);
  add("Restoration notes (owner's own words — TREAT AS GROUND TRUTH)", p.restorationNotes);
  add("Plot size", p.plotSize);
  add("Built area", p.builtArea);
  add("Tenure", p.tenure);
  add("Highlights", p.highlights);
  add("Site condition", p.siteCondition);
  add("Description", p.description);

  return [
    "WRITE THE PROVENANCE PAGE FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "headline: ≤6 words / 50 chars.",
    "para1: build / origins, 40-60 words, 2-3 <em>.",
    "para2: restoration, 40-60 words, 2-3 <em>.",
    "para3: ONE sentence landing, ≤25 words.",
    "originallyFor: 2-3 word phrase + 3-6 word caption.",
    "builtCaption / restoredCaption / titleCaption: short captions under each timeline year.",
  ].join("\n");
}

export const PROVENANCE_TOOL = {
  name: "fill_provenance",
  description: "Submit the page-3 (provenance) copy.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string" },
      para1: { type: "string", description: "40-60 word origins / build paragraph; 2-3 <em> highlights." },
      para2: { type: "string", description: "40-60 word restoration paragraph; 2-3 <em> highlights." },
      para3: { type: "string", description: "ONE sentence landing, ≤25 words." },
      originallyFor: { type: "string", description: "2-3 word phrase, e.g. 'Private use'." },
      originallyForCaption: { type: "string", description: "3-6 word caption." },
      builtCaption: { type: "string", description: "3-6 word caption under built year." },
      restoredCaption: { type: "string", description: "3-6 word caption under restored year." },
      titleCaption: { type: "string", description: "3-6 word caption under title cell." },
    },
    required: [
      "headline", "para1", "para2", "para3",
      "originallyFor", "originallyForCaption",
      "builtCaption", "restoredCaption", "titleCaption",
    ],
    additionalProperties: false,
  },
};
