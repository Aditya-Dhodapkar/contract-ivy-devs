// Decides which per-page templates to include in a given property's
// brochure. The cover is always included; other pages turn on/off based on
// data + the per-property brochure toggles + the per-render Page 3 variant.

import type { PropertyRecord } from "@/lib/repo/properties";
import type { PageId, Page3Variant } from "./types";

/** Variants that can replace the default "location" page when the seller
 *  asks us to hide the map. The PageId is the slot in PageSlotSet that
 *  matches the variant's id. */
const PAGE3_VARIANT_TO_PAGEID: Record<Page3Variant, PageId> = {
  "location":     "location",
  "within-reach": "withinReach",
  "photo-essay":  "photoEssay",
  "the-setting":  "theSetting",
  "provenance":   "provenance",
};

export function pagesFor(
  p: PropertyRecord,
  page3Variant: Page3Variant = "location"
): PageId[] {
  const included: PageId[] = ["cover", "glance"];

  // Page 3 — five variants. The editor's Show map / Hide map toggle is
  // the single source of truth (we don't read the legacy showMapOnBrochure
  // flag anymore — its checkbox was removed from the form). If the
  // brochure editor picked a non-map variant, the switch below honours
  // it; "location" mode requires a city to render a meaningful map.
  if (page3Variant === "location") {
    if (p.city) included.push("location");
  } else {
    // For the alternative templates, only require enough data to render.
    // Within reach needs nearby places; photo-essay needs photos; the
    // setting and provenance always work (they degrade gracefully).
    switch (page3Variant) {
      case "within-reach":
        if ((p.nearby?.length ?? 0) >= 2) included.push("withinReach");
        break;
      case "photo-essay":
        if ((p.photos?.length ?? 0) >= 4) included.push("photoEssay"); // cover + 3 essay shots
        break;
      case "the-setting":
        included.push("theSetting");
        break;
      case "provenance":
        included.push("provenance");
        break;
    }
  }

  // Site plan: include if she's not opted out AND there's SOMETHING to show.
  const hasAnyParticular =
    !!p.tenure || !!p.plotSize || !!p.builtArea || !!p.bedrooms ||
    !!p.yearBuilt || !!p.shape || !!p.topography || !!p.boundary ||
    !!p.services;
  if (p.showPlotOnBrochure !== false && (p.floorPlan || hasAnyParticular)) {
    included.push("sitePlan");
  }

  // Gallery: include when ≥3 photos (cover + 2 gallery min).
  if ((p.photos?.length ?? 0) >= 3) included.push("feature");
  // Closing page is always last.
  included.push("closing");
  return included;
}

export { PAGE3_VARIANT_TO_PAGEID };
