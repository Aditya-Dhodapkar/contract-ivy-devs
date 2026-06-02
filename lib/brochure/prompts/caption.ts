// Photo-caption drafter (page-5 gallery). Single-call: takes one photo
// URL + minimal property context and returns a 2-4 word editorial tag.
// Bulk callers fan out N parallel single calls — keeps each prompt
// tight, captions independent, retries trivial.
//
// Length is HARD-ENFORCED in the prompt: 2-4 words, not 1, not 5. Single
// words read as taxonomy ("Pool", "Kitchen"); 5+ slip into headline
// territory. The sweet spot is a small editorial phrase.

import type { PropertyRecord } from "@/lib/repo/properties";

export const CAPTION_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA. You are writing a SHORT
caption for a single photo in a luxury property brochure's gallery page.

WHAT THIS IS
- A 2-4 word editorial tag that sits under or alongside the photo.
- NOT a sentence. NOT a description. NOT a headline. A tag.
- Examples of the register:
    "Sea-facing terrace"
    "Open-plan kitchen"
    "Coral walls"
    "Morning light"
    "Garden, mature palms"
    "Boat mooring"
    "Bedroom suite"
    "Pool at dusk"

HARD RULES
- LENGTH: 2-4 words. Never 1 word. Never 5+ words.
- No periods, no quotation marks, no em-dashes.
- British-English spelling.
- Title-case the first word only ("Sea-facing terrace", not "Sea-Facing
  Terrace").
- NEVER invent specifics not visible in the photo. If you cannot see the
  feature, fall back to a generic editorial tag based on what you CAN see
  (e.g. "Interior light" if you see a window, "Garden detail" if green).
- No clichés (NEVER: stunning, beautiful, perfect, dream, oasis, paradise).

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

export function buildCaptionUserPrompt(
  property: Partial<PropertyRecord>,
  ctx: { positionHint?: string } = {}
): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  // Context only — the photo itself is the primary input.
  add("Property type", property.propertyType);
  add("City", property.city);
  add("Country", property.country);
  add("Highlights", property.highlights);
  if (ctx.positionHint) {
    add(
      "Position in gallery (context only — do not name in caption)",
      ctx.positionHint
    );
  }

  return [
    "WRITE A 2-4 WORD CAPTION FOR THE PHOTO PROVIDED.",
    "Context (use sparingly — the photo is the primary input):",
    lines.join("\n") || "(no extra context)",
    "",
    "caption: 2-4 words. Editorial tag. Title-case first word only.",
  ].join("\n");
}

export const CAPTION_TOOL = {
  name: "fill_caption",
  description: "Submit a 2-4 word photo caption.",
  input_schema: {
    type: "object" as const,
    properties: {
      caption: {
        type: "string",
        description: "2-4 word editorial tag. No periods, no quotes.",
      },
    },
    required: ["caption"],
    additionalProperties: false,
  },
};
