// Page 3 — Location & neighbourhood. Claude fills 3 slots:
//   headline  — e.g. "On the quiet side."
//   intro     — ~50 word evocative paragraph above the map
//   closing   — ~50-80 word two-column paragraph at the bottom
//
// The map image and the nearby list come straight from data; Claude writes
// only the editorial wrapping.

import type { PropertyRecord } from "@/lib/repo/properties";

export const LOCATION_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA, a private luxury real-
estate practice in Kenya. You are writing page 3 — "Location & Neighbourhood"
— of a printed property brochure.

VOICE
- Restrained, sparing, slightly literary. British-English spelling.
- Short sentences. Strong verbs. No marketing clichés
  (NEVER: luxurious, stunning, must-see, breathtaking, perfect, dream,
   immaculate, exquisite, gem, oasis, sanctuary, hidden gem).
- Italics used sparingly for accent via <em>.

HARD RULES
- NEVER invent geography. Use only places the data mentions (city, country,
  nearby places). Do not name neighbourhoods, landmarks, schools or roads
  unless they're in the supplied data.
- It is fine to write generally about Kenya / the city if the data is thin.
- Do not promise things you can't substantiate ("walking distance to X" only
  if X is in nearby with a short distance).
- HEADLINE LENGTH IS A HARD CONSTRAINT: max 6 words, max 50 characters
  (including spaces and any <br/> tag). The headline renders at 60-72pt
  serif on the page — anything longer wraps to a third line which is
  visually unacceptable. Aim for 3-5 words. Prefer two short clauses
  separated by a manual <br/> over one long clause.

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

const LOCATION_EXAMPLE = `
EXAMPLE — Rosslyn Lone Tree (Nairobi, nearby: UN Gigiri 3.2km, Karura
Forest 2.0km, Village Market 2.8km, Rosslyn Academy 1.4km):
  headline: "At the One Off Gallery,<br/>on the <em>quiet side</em>."
  intro:    "Rosslyn sits on Nairobi's northern ridge — a long-established diplomatic and residential pocket bordering Karura Forest, ten minutes from the UN complex at Gigiri."
  closing:  "The neighbourhood is one of Nairobi's quietest at this scale — large garden plots, embassies and ambassadorial residences, with through-traffic kept off the residential lanes. The eucalyptus and cape chestnut canopy that defines Rosslyn carries straight onto the parcel; the air, even mid-afternoon, is noticeably cooler than the city below."
`.trim();

export function buildLocationUserPrompt(p: PropertyRecord): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };

  add("Title", p.title);
  add("City", p.city);
  add("Country", p.country);
  add("Type", p.propertyType);
  add("Plot size", p.plotSize);
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
  add("Description (owner's own words)", p.description);

  return [
    LOCATION_EXAMPLE,
    "",
    "NOW WRITE PAGE 3 FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "headline: MAX 6 WORDS / 50 CHARACTERS. Wraps to at most 2 lines.",
    "  <em> + <br/> allowed. Two short clauses split by <br/> is ideal.",
    "  GOOD: 'On the quiet side.' / 'Where Mykonos exhales.' / 'North-facing,<br/>by design.'",
    "  BAD: 'Where the Aegean meets the sand, and the island exhales.' (TOO LONG)",
    "intro: ~50 words evoking the setting, anchored only in city / country /",
    "  nearby data. Two sentences is ideal.",
    "closing: 50-80 words, character of the neighbourhood, what daily life",
    "  feels like there. Two short paragraphs OR one continuous one.",
  ].join("\n");
}

export const LOCATION_TOOL = {
  name: "fill_location",
  description: "Submit the page-3 'location & neighbourhood' copy. ALL fields required.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string", description: "MAX 6 words / 50 chars (must fit ≤2 lines at 60-72pt serif). <em> + <br/> allowed." },
      intro:    { type: "string", description: "~50 words above the map; two sentences." },
      closing:  { type: "string", description: "50-80 words, character of the neighbourhood." },
    },
    required: ["headline", "intro", "closing"],
    additionalProperties: false,
  },
};
