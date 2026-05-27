// Page 4 — Site plan & particulars. Claude fills 1 slot:
//   headline — e.g. "Two plots, one clean acre."
// The particulars table and floor-plan image are pure data — no AI involved.

import type { PropertyRecord } from "@/lib/repo/properties";

export const SITE_PLAN_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA, a private luxury real-
estate practice in Kenya. You are writing ONLY the page-4 headline — a
single line introducing the property's land / site plan.

VOICE
- Restrained, sparing, slightly literary. British-English spelling.
- Short. 4-8 words. <em> tags allowed for emphasis on one word.
- No marketing clichés (NEVER: luxurious, stunning, must-see, breathtaking,
  perfect, dream, immaculate, exquisite).

HARD RULES
- NEVER invent facts. Only use what's in the property data supplied.

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

const SITE_PLAN_EXAMPLE = `
EXAMPLE — Rosslyn Lone Tree (1.009 acres, two adjacent freehold plots):
  headline: "Two plots, one <em>clean acre</em>."

EXAMPLE — Beachfront Villa (1.2 acres, four-bedroom restored house):
  headline: "Built to <em>belong</em> to the land."
`.trim();

export function buildSitePlanUserPrompt(p: PropertyRecord): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  add("Type", p.propertyType);
  add("Plot size", p.plotSize);
  add("Built area", p.builtArea);
  add("Bedrooms", p.bedrooms);
  add("Shape", p.shape);
  add("Topography", p.topography);
  add("Highlights", p.highlights);

  return [
    SITE_PLAN_EXAMPLE,
    "",
    "NOW WRITE THE PAGE-4 HEADLINE FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "Single line. 4-8 words. <em> on the most evocative word.",
  ].join("\n");
}

export const SITE_PLAN_TOOL = {
  name: "fill_site_plan",
  description: "Submit the page-4 headline. headline required.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string", description: "4-8 words; <em> allowed." },
    },
    required: ["headline"],
    additionalProperties: false,
  },
};
