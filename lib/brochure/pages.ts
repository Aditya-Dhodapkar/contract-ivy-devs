// Decides which per-page templates to include in a given property's
// brochure. The cover is always included; other pages turn on/off based on
// data + the per-property brochure toggles (showMapOnBrochure / showPlotOnBrochure).
//
// As more per-page templates land, register them here.

import type { PropertyRecord } from "@/lib/repo/properties";
import type { PageId } from "./types";

export function pagesFor(p: PropertyRecord): PageId[] {
  const included: PageId[] = ["cover", "glance"];
  // Location: include if the seller hasn't opted out and we have city.
  // The map block inside the page degrades to a neutral panel when lat/lng
  // are missing, so we don't need lat/lng to include the page.
  if (p.city && p.showMapOnBrochure !== false) included.push("location");

  // Site plan & particulars: include if she's not opted out AND there's
  // SOMETHING to show — either a floor-plan image, or any of the particulars
  // rows have data. Skipping the page entirely is cleaner than a half-empty one.
  const hasAnyParticular =
    !!p.tenure || !!p.plotSize || !!p.builtArea || !!p.bedrooms ||
    !!p.yearBuilt || !!p.shape || !!p.topography || !!p.boundary ||
    !!p.services;
  if (p.showPlotOnBrochure !== false && (p.floorPlan || hasAnyParticular)) {
    included.push("sitePlan");
  }
  // Future pages:
  // included.push("feature", "closing");
  return included;
}
