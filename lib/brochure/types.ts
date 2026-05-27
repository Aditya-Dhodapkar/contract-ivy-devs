// Brochure slot inventory — the editorial copy strings Claude fills.
// Everything else on the brochure (photos, ref number, price, specs,
// amenities, contact) comes straight from the property record and is NOT
// in this type. Keeping the slot set small makes the preview/edit step
// quick and the prompt cheap.

export interface BrochureSlots {
  /** Short under-title tag on the cover — e.g. "Two plots · sold together"
   *  or "Beachfront villa · with private dhow jetty". 4–8 words. */
  coverTagline: string;
  /** §1 Introduction editorial headline — e.g. "Quietly offered, privately sold." */
  introHeadline: string;
  /** §1 Lede paragraph, 30–60 words, magazine voice. */
  introLede: string;
  /** §2 The property — headline, e.g. "Built quietly, kept well." */
  propertyHeadline: string;
  /** §3 The land — headline, e.g. "Two plots, one clean acre." */
  landHeadline: string;
  /** §4 Feature section — the property's standout. Title, e.g.
   *  "A garden, already grown in." */
  featureHeadline: string;
  /** §4 Feature section — body, ~50 words, picks the strongest highlight
   *  or amenity and writes about it specifically. */
  featureBody: string;
  /** §5 Closing — repeats the cover voice, e.g. "Quietly offered, privately sold." */
  closingHeadline: string;
}

/* ----------------------- Per-page slot types (new) -----------------------
 * The new per-page template architecture splits the monolithic BrochureSlots
 * into one type per page. Claude fills one schema per page via tool-use; the
 * assembler interpolates those values into templates/brochure/<page>.html.
 * The old `BrochureSlots` interface above is preserved so the React-PDF
 * prototype keeps working during the transition.
 * ------------------------------------------------------------------------ */

export interface CoverSlots {
  /** Short descriptor above the headline — e.g. "A One-Acre Garden Parcel". */
  eyebrow: string;
  /** Big serif headline. `<br/>` and `<em>` tags are allowed and encouraged
   *  (e.g. "Rosslyn<br/><em>Lone Tree</em>"). */
  title: string;
  /** ~30-50 word evocative paragraph under the title. */
  sub: string;
}

export interface GlanceSlots {
  headline: string;     // big serif statement, <em> allowed
  priceTagline: string; // 3-6 word subline under the price
  blurb: string;        // ~30 word sentence beside the price
  bodyPara1: string;    // 60-90 words
  bodyPara2: string;    // 2-3 sentences OR empty string
}

export interface LocationSlots {
  headline: string; // 1-2 line poetic; <em>+<br/> allowed
  intro: string;    // ~50 words above the map
  closing: string;  // 50-80 word bottom paragraph
}

export interface SitePlanSlots {
  headline: string; // 4-8 words; <em> allowed
}

export interface FeatureSlots {
  headline: string; // ≤8 words; <em> allowed
  intro: string;    // 30-60 words, property-aware editorial
}

export interface ClosingSlots {
  headline: string; // 4-8 words; <em> allowed
  terms: string;    // 60-100 words; \n\n for paragraph breaks
}

/** Anchor type — every page's slot type registers here. */
export interface PageSlotSet {
  cover: CoverSlots;
  glance: GlanceSlots;
  location: LocationSlots;
  sitePlan: SitePlanSlots;
  feature: FeatureSlots;
  closing: ClosingSlots;
}

export type PageId = keyof PageSlotSet;

export const SLOT_LABELS: Record<keyof BrochureSlots, string> = {
  coverTagline: "Cover tagline",
  introHeadline: "Introduction headline",
  introLede: "Introduction paragraph",
  propertyHeadline: "Property section headline",
  landHeadline: "Land section headline",
  featureHeadline: "Feature page headline",
  featureBody: "Feature page paragraph",
  closingHeadline: "Closing headline",
};
