// Deliverables #52–#62. A property cannot go live until the essentials are
// present; if blocked, the system says exactly what's missing. Pure function.
//
// #59 (signed mandate uploaded) depends on document storage (Step 3). Until
// then `hasMandateDoc` resolves false, so the mandate correctly reports as
// missing — no rework when Step 3 wires the real value in.

import type { PropertyRecord } from "./repo/properties";

export interface ChecklistResult {
  ok: boolean;
  missing: string[];
}

export function checklist(
  p: Partial<PropertyRecord>,
  hasMandateDoc: boolean
): ChecklistResult {
  const missing: string[] = [];

  if (!p.photos || p.photos.length < 3) missing.push("At least 3 photos");
  if (!p.title?.trim()) missing.push("Title");
  if (!p.description?.trim()) missing.push("Description");
  if (p.price == null || p.price <= 0) missing.push("Price");
  if (!p.city?.trim()) missing.push("City");

  // Bedrooms/bathrooms only required for houses (brief: "if it's a house").
  if (p.propertyType === "house") {
    if (p.bedrooms == null) missing.push("Bedrooms");
    if (p.bathrooms == null) missing.push("Bathrooms");
  }

  if (!p.plotSize?.trim()) missing.push("Plot size");
  if (!hasMandateDoc) missing.push("Signed mandate document");
  if (!p.assignedAgentId) missing.push("Assigned agent");

  return { ok: missing.length === 0, missing };
}
