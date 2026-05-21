// Server-only Anthropic SDK wrapper for brochure copy. Uses tool-use to
// force structured JSON output (more reliable than asking for JSON in prose).
// Low temperature — we want consistent, on-brand copy, not creative drift.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { BrochureSlots } from "./types";
import type { PropertyRecord } from "@/lib/repo/properties";

let cached: Anthropic | null = null;
function client(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Add it to .env (it's gitignored) before generating brochures."
    );
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

const TOOL = {
  name: "emit_brochure_copy",
  description:
    "Submit the final editorial copy for the brochure. ALL fields required. No extras.",
  input_schema: {
    type: "object" as const,
    properties: {
      coverTagline:     { type: "string", description: "4–8 words, cover under-title." },
      introHeadline:    { type: "string", description: "Editorial headline (≤8 words)." },
      introLede:        { type: "string", description: "30–60 words, magazine voice." },
      propertyHeadline: { type: "string", description: "Headline for §II (≤8 words)." },
      landHeadline:     { type: "string", description: "Headline for §III (≤8 words)." },
      featureHeadline:  { type: "string", description: "Feature page headline (≤8 words)." },
      featureBody:      { type: "string", description: "~50 words on the property's standout." },
      closingHeadline:  { type: "string", description: "Closing headline (≤8 words)." },
    },
    required: [
      "coverTagline",
      "introHeadline",
      "introLede",
      "propertyHeadline",
      "landHeadline",
      "featureHeadline",
      "featureBody",
      "closingHeadline",
    ],
    additionalProperties: false,
  },
};

export async function draftBrochureCopy(p: PropertyRecord): Promise<BrochureSlots> {
  const res = await client().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    temperature: 0.4, // light creative range, no wild drift
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: buildUserPrompt(p) }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use" || block.name !== TOOL.name) {
    throw new Error("Claude did not return brochure copy in the expected format.");
  }
  // The SDK types `input` as unknown — narrow it via the tool schema.
  return block.input as BrochureSlots;
}
