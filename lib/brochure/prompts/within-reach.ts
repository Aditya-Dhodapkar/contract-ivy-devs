// Page 3 (alternative) — "Within reach". Same idea as the standard
// location page but without a map. The list of nearby places carries the
// page on its own. Claude fills 2 slots: headline + intro paragraph.

import type { PropertyRecord } from "@/lib/repo/properties";

export const WITHIN_REACH_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA. You are writing page 3
of a luxury property brochure when the seller has asked us NOT to show
the map pin. The page still names the city / region and lists nearby
landmarks (with distances) but does not embed a map.

VOICE
- Restrained, sparing, slightly literary. British-English spelling.
- Headline: 1-2 short lines, MAX 6 words / 50 characters total (must fit
  ≤2 lines at 60-72pt serif). <em> + <br/> allowed.
- Intro: 30-60 words. Two short sentences. Editor's-note voice.
- No clichés (NEVER: luxurious, stunning, must-see, breathtaking, perfect,
  dream, immaculate, exquisite, gem, oasis, sanctuary, hidden gem).

HIGHLIGHT WORDS
- In the intro, wrap 2-3 key nouns in <em> tags — places, qualities,
  distinguishing elements. NEVER prepositions or articles. NEVER more
  than 3 per paragraph.

HARD RULES
- NEVER invent geography. Only use the city / country / nearby places
  the data provides.
- It is fine to write generally about the region if data is thin.
- The page anchor is "§ II — Within reach". Do not contradict it.

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

const WITHIN_REACH_EXAMPLE = `
EXAMPLE — Serenity Beach House (Mykonos; nearby: Ftelia Beach 0.1km,
Nightangle Club 0.2km, Ano Mera 2.8km, Mykonos Town 6.2km, Airport 8.4km):
  headline: "On the <em>quiet</em> side<br/>of the island."
  intro: "Ftelia is the northern shoulder of <em>Mykonos</em> — where the meltemi blows clean and the tourist concentration thins. Everything practical is twenty minutes or less; everything spectacular, the same."
`.trim();

export function buildWithinReachUserPrompt(p: PropertyRecord): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  add("Title", p.title);
  add("City", p.city);
  add("Country", p.country);
  add("Type", p.propertyType);
  if (p.nearby?.length) {
    add(
      "Nearby places",
      p.nearby
        .filter((n) => n.place || n.distance)
        .map((n) => `${n.place} (${n.distance})`)
        .join("; ")
    );
  }
  add("Highlights", p.highlights);
  add("Description (owner's words)", p.description);

  return [
    WITHIN_REACH_EXAMPLE,
    "",
    "NOW WRITE PAGE 3 (within reach, no map) FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "headline: MAX 6 words / 50 chars. <em> + <br/> allowed.",
    "intro: 30-60 words, two sentences, 2-3 <em> highlights on key nouns.",
  ].join("\n");
}

export const WITHIN_REACH_TOOL = {
  name: "fill_within_reach",
  description: "Submit the page-3 (within reach) copy.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string", description: "≤6 words / 50 chars. <em>+<br/> allowed." },
      intro: { type: "string", description: "30-60 word editor's-note intro. 2-3 <em> highlights." },
    },
    required: ["headline", "intro"],
    additionalProperties: false,
  },
};
