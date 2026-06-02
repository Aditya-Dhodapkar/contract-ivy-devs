// Page 3 (alternative) — "The setting". Atmospheric editorial prose +
// 4-cell fact strip. No place is named; pure sense-of-place writing.
// Best for high-privacy properties.

import type { PropertyRecord } from "@/lib/repo/properties";

export const THE_SETTING_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA. You are writing page 3
of a luxury property brochure in "The Setting" mode — atmospheric prose
that conveys what the place feels like, without naming any specific
geography (city, neighbourhood, landmark). Privacy is the point.

You also fill a 4-cell fact strip at the bottom: Sun, Terrain, Sea,
Season. Each cell has a value (1-3 words) + a small caption (3-6 words).
If a cell doesn't apply to this property (e.g. inland → no Sea cell),
set BOTH its value and caption to empty string and the renderer hides
that cell.

VOICE
- Restrained, slightly literary. British-English spelling.
- Headline: MAX 6 words / 50 chars. <em>+<br/> allowed.
- Body: TWO paragraphs of italic editorial prose. Each 35-50 words.
  Short and evocative. The type is italic serif at 24pt — the prose
  needs breathing room, not density. Two well-chosen sentences per
  paragraph; not three.
- No clichés (NEVER: luxurious, stunning, must-see, breathtaking, perfect,
  dream, immaculate, exquisite, gem, oasis, sanctuary).

HIGHLIGHT WORDS
- In each body paragraph, wrap 2-3 evocative phrases in <em> tags —
  qualities, atmospheric details, sensory specifics. Not prepositions.

HARD RULES
- NEVER name a city, region, country, neighbourhood, road, landmark,
  shop, restaurant, beach, mountain, anything. The page is intentionally
  abstract about location.
- Use atmospheric specifics that don't pin the geography — light quality,
  wind direction, sound, temperature, vegetation type, season.
- Fact strip Sun cell: use facingDirection if supplied
  (N/NE/E/SE/S/SW/W/NW → "North-facing" etc.); else infer from
  description; else leave empty.
- Fact strip Sea/Water cell: only if the property is genuinely near water.
- Fact strip Season cell: implied by the property type / climate; OK to
  leave empty.

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

export function buildTheSettingUserPrompt(p: PropertyRecord): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  add("Type", p.propertyType);
  add("Facing direction", p.facingDirection);
  add("Plot size", p.plotSize);
  add("Built area", p.builtArea);
  add("Highlights", p.highlights);
  add("Amenities", p.amenities);
  add("Topography", p.topography);
  add("Site condition", p.siteCondition);
  add("Description (atmospheric notes only)", p.description);

  return [
    "WRITE THE SETTING PAGE FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "Remember: ZERO named geography. Atmospheric prose only.",
    "headline: ≤6 words / 50 chars.",
    "bodyPara1 + bodyPara2: italic editorial, 35-50 words each, 2-3 <em> per para.",
    "factSun/Terrain/Sea/Season: value (1-3 words) + caption (3-6 words). Empty string to hide.",
  ].join("\n");
}

export const THE_SETTING_TOOL = {
  name: "fill_the_setting",
  description: "Submit the page-3 (the setting) copy. All fields required (empty string OK for inapplicable facts).",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string" },
      bodyPara1: { type: "string", description: "35-50 word italic prose; 2-3 <em> highlights." },
      bodyPara2: { type: "string", description: "35-50 word italic prose; 2-3 <em> highlights." },
      factSunValue: { type: "string" },
      factSunCaption: { type: "string" },
      factTerrainValue: { type: "string" },
      factTerrainCaption: { type: "string" },
      factSeaValue: { type: "string" },
      factSeaCaption: { type: "string" },
      factSeasonValue: { type: "string" },
      factSeasonCaption: { type: "string" },
    },
    required: [
      "headline", "bodyPara1", "bodyPara2",
      "factSunValue", "factSunCaption",
      "factTerrainValue", "factTerrainCaption",
      "factSeaValue", "factSeaCaption",
      "factSeasonValue", "factSeasonCaption",
    ],
    additionalProperties: false,
  },
};
