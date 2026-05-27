// Page 6 — Terms & Enquiries (closing). Claude fills 2 slots:
//   headline — closes the brochure with a line that echoes the cover voice
//   terms    — 60-100 word paragraph stating tenure, price, what's
//              included/excluded. Property-aware.
// The 5-step process, contact card, and legal disclaim are all static.

import type { PropertyRecord } from "@/lib/repo/properties";

export const CLOSING_SYSTEM_PROMPT = `
You are the in-house copywriter for SANSI AFRICA, a private luxury real-
estate practice in Kenya. You are writing ONLY the page-6 (closing) copy.

The page closes the brochure. To the right of your headline sits a static
five-step process and a contact card. To the left, your "terms" paragraph
sits under a small "The terms." subheading and tells the buyer what is
on offer — tenure, price, and what is or isn't contemplated as part of
the sale.

VOICE
- Restrained, sparing, slightly literary. British-English spelling.
- Headline: 4-8 words. <em> allowed on one word. Echoes the cover voice —
  "Quietly offered, privately sold." / "By appointment, by introduction."
- Terms paragraph: 60-100 words, formal but not legalistic. Two short
  paragraphs separated by a single blank line are fine; one is fine too.
- No marketing clichés (NEVER: luxurious, stunning, must-see, breathtaking,
  perfect, dream, immaculate, exquisite).
- Don't restate things already on prior pages (room counts, amenities).
  Stick to: how the property is offered, what's included, what isn't.

HARD RULES
- NEVER invent facts. Only use what's in the property data supplied.
- Always state the asking price in KES with thousands separators (e.g.
  "KES 18,500,000"). Always state tenure if known.
- Always add: "exclusive of legal fees, stamp duty and statutory charges."
- If sale terms specify single transaction / single buyer, mention that
  subdivision or part-sale is not contemplated.
- If there's no price set, write "Price on application." instead of a
  number — never invent one.

OUTPUT
Return JSON only, matching the tool schema. No commentary.
`.trim();

const CLOSING_EXAMPLE = `
EXAMPLE — Rosslyn Lone Tree (1 acre, freehold, KES 95,000,000, single buyer):
  headline: "Quietly offered, <em>privately sold</em>."
  terms: "The parcel is offered freehold, comprising two adjacent registered titles sold together as a single one-acre lot. Asking price is KES 95,000,000, exclusive of legal fees, stamp duty and statutory charges. Subdivision, separate sale or part-sale is not contemplated.\\n\\nTitle deeds, recent searches and survey beacons are available for inspection by qualified buyers under a non-disclosure undertaking."

EXAMPLE — Beachfront Villa (4-bed, freehold, KES 18,500,000, single buyer):
  headline: "By appointment, <em>by introduction</em>."
  terms: "The house is offered freehold, restored and ready for occupation. Asking price is KES 18,500,000, exclusive of legal fees, stamp duty and statutory charges. Sale is contemplated as a single transaction to a single buyer; chattels and staff arrangements are negotiable separately.\\n\\nTitle documents and recent searches are available for inspection by qualified buyers under a non-disclosure undertaking."
`.trim();

export function buildClosingUserPrompt(p: PropertyRecord): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  add("Title", p.title);
  add("Type", p.propertyType);
  add("Tenure", p.tenure);
  add(
    "Price (KES)",
    p.price != null
      ? new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(p.price)
      : undefined
  );
  add("Sale terms", p.saleTerms);
  add("Site condition", p.siteCondition);

  return [
    CLOSING_EXAMPLE,
    "",
    "NOW WRITE THE PAGE-6 HEADLINE AND TERMS FOR THIS PROPERTY:",
    lines.join("\n"),
    "",
    "Headline: 4-8 words, <em> on one word. Terms: 60-100 words, formal-but-warm.",
  ].join("\n");
}

export const CLOSING_TOOL = {
  name: "fill_closing",
  description: "Submit the page-6 closing copy. Both fields required.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string", description: "4-8 words; <em> allowed." },
      terms: { type: "string", description: "60-100 word terms paragraph. Use \\n\\n for paragraph breaks." },
    },
    required: ["headline", "terms"],
    additionalProperties: false,
  },
};
