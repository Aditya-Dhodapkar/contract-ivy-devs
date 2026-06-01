// "Let AI design page 5" — Claude analyses the property's gallery photos
// (via vision) plus context, picks a TEMPLATE (row partition) + photo
// order. The editor receives this and surfaces it to the user, who can
// ship as-is or pick a different template.
//
// Output schema:
//   { templateId: "5-pair-trio", photoOrder: [url1, url2, ...] }

import type { PropertyRecord } from "@/lib/repo/properties";
import type { Template } from "../templates";

export const AI_LAYOUT_SYSTEM_PROMPT = `
You are the lead editorial designer for SANSI AFRICA, a private luxury
real-estate practice in Kenya. You design page 5 (the photo gallery) of
property brochures.

YOUR JOB
Look at the gallery photos provided + the property context. From the list
of FITTING TEMPLATES (already filtered to ones whose row partition works
for these photo aspects), pick:
  1. The single template that best tells this property's story.
  2. A photo ORDER — which photo lands in slot 1, slot 2, etc.

The template's row partition is fixed (e.g. "5-hero-quartet" = 1 hero
row + 4-photo row). Your order determines which photo appears in the
hero spot.

DESIGN PRINCIPLES
- The first photo lands in the FIRST/MOST PROMINENT slot. Pick the most
  visually striking photo (drama, mood, signature shot) as photo 1.
- Group meaningfully — interiors with interiors, exteriors with exteriors,
  light with light.
- A wide landscape with strong composition is usually the best hero.
- A portrait/square hero can work but reads quieter — favour landscape
  when one is available.
- Respect the property's character (beachfront leads with sea/sky;
  architectural villa leads with structure; land leads with the landscape).

CONSTRAINTS
- Pick exactly ONE template id from the list provided.
- Photo order must include EVERY url from the provided gallery, exactly
  once, no extras.

OUTPUT
Return JSON only via the pick_layout tool. No commentary.
`.trim();

export function buildAiLayoutUserPrompt(
  p: PropertyRecord,
  gallery: Array<{ url: string; w: number; h: number; caption?: string }>,
  fittingTemplates: Template[]
): string {
  const lines: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  add("Title", p.title);
  add("City", p.city);
  add("Type", p.propertyType);
  add("Description", p.description);
  add("Highlights", p.highlights);
  add("Amenities", p.amenities);

  lines.push("");
  lines.push("AVAILABLE GALLERY PHOTOS:");
  gallery.forEach((g, i) => {
    const shape = g.w > g.h * 1.10 ? "landscape" : g.w < g.h * 0.90 ? "portrait" : "square";
    lines.push(
      `  Photo ${i + 1} — ${shape} (${g.w}×${g.h})${g.caption ? ` — caption: "${g.caption}"` : ""}`
    );
    lines.push(`    url: ${g.url}`);
  });

  lines.push("");
  lines.push("FITTING TEMPLATES (pick one):");
  fittingTemplates.forEach((t) => {
    lines.push(`  id: "${t.id}" — ${t.label} (${t.rows.join("+")}) — ${t.blurb}`);
  });

  return [
    "Design the gallery page for this property.",
    "",
    lines.join("\n"),
    "",
    "Pick the single template id + the photo order that best tells this property's story. Return via the pick_layout tool.",
  ].join("\n");
}

export const AI_LAYOUT_TOOL = {
  name: "pick_layout",
  description: "Pick a template id + photo order for the gallery page.",
  input_schema: {
    type: "object" as const,
    properties: {
      templateId: {
        type: "string",
        description: "Exact id from the FITTING TEMPLATES list.",
      },
      photoOrder: {
        type: "array",
        items: { type: "string" },
        description: "Every url from the gallery, in the order they should appear (slot 1, slot 2, ...).",
      },
    },
    required: ["templateId", "photoOrder"],
    additionalProperties: false,
  },
};
