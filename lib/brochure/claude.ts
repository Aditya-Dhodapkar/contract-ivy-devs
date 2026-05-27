// Server-only Anthropic SDK wrapper for brochure copy. Uses tool-use to
// force structured JSON output (more reliable than asking for JSON in prose).
// Low temperature — we want consistent, on-brand copy, not creative drift.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { COVER_SYSTEM_PROMPT, buildCoverUserPrompt, COVER_TOOL } from "./prompts/cover";
import { GLANCE_SYSTEM_PROMPT, buildGlanceUserPrompt, GLANCE_TOOL } from "./prompts/glance";
import { LOCATION_SYSTEM_PROMPT, buildLocationUserPrompt, LOCATION_TOOL } from "./prompts/location";
import { SITE_PLAN_SYSTEM_PROMPT, buildSitePlanUserPrompt, SITE_PLAN_TOOL } from "./prompts/site-plan";
import type { BrochureSlots, CoverSlots, GlanceSlots, LocationSlots, SitePlanSlots } from "./types";
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

/** Per-page cover draft. Returns just the 3 cover slots. Used by the new
 *  per-page pipeline (templates/brochure/01-cover.html). */
export async function draftCoverCopy(p: PropertyRecord): Promise<CoverSlots> {
  const res = await client().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 512,
    temperature: 0.4,
    system: COVER_SYSTEM_PROMPT,
    tools: [COVER_TOOL],
    tool_choice: { type: "tool", name: COVER_TOOL.name },
    messages: [{ role: "user", content: buildCoverUserPrompt(p) }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use" || block.name !== COVER_TOOL.name) {
    throw new Error("Claude did not return cover copy in the expected format.");
  }
  return block.input as CoverSlots;
}

/** Per-page page-2 draft. Returns the 5 "at a glance" slots. */
export async function draftGlanceCopy(p: PropertyRecord): Promise<GlanceSlots> {
  const res = await client().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 768,
    temperature: 0.4,
    system: GLANCE_SYSTEM_PROMPT,
    tools: [GLANCE_TOOL],
    tool_choice: { type: "tool", name: GLANCE_TOOL.name },
    messages: [{ role: "user", content: buildGlanceUserPrompt(p) }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use" || block.name !== GLANCE_TOOL.name) {
    throw new Error("Claude did not return glance copy in the expected format.");
  }
  return block.input as GlanceSlots;
}

export async function draftLocationCopy(p: PropertyRecord): Promise<LocationSlots> {
  const res = await client().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 768,
    temperature: 0.4,
    system: LOCATION_SYSTEM_PROMPT,
    tools: [LOCATION_TOOL],
    tool_choice: { type: "tool", name: LOCATION_TOOL.name },
    messages: [{ role: "user", content: buildLocationUserPrompt(p) }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use" || block.name !== LOCATION_TOOL.name) {
    throw new Error("Claude did not return location copy in the expected format.");
  }
  return block.input as LocationSlots;
}

export async function draftSitePlanCopy(p: PropertyRecord): Promise<SitePlanSlots> {
  const res = await client().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 256,
    temperature: 0.4,
    system: SITE_PLAN_SYSTEM_PROMPT,
    tools: [SITE_PLAN_TOOL],
    tool_choice: { type: "tool", name: SITE_PLAN_TOOL.name },
    messages: [{ role: "user", content: buildSitePlanUserPrompt(p) }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use" || block.name !== SITE_PLAN_TOOL.name) {
    throw new Error("Claude did not return site-plan copy in the expected format.");
  }
  return block.input as SitePlanSlots;
}

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
