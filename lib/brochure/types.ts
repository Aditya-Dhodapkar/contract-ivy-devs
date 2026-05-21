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
