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

/* ---- Page 3 alternatives (when seller hides the map / exact location) ---- */

export interface WithinReachSlots {
  headline: string; // ≤6 words / 50 chars
  intro: string;    // ~50 words above the list
}

export interface PhotoEssaySlots {
  headline: string;     // ≤6 words / 50 chars
  fig1Label: string;    // e.g. "Threshold"
  fig1Headline: string; // ≤6 words; <em> allowed
  fig1Body: string;     // 50-70 words
  fig2Label: string;
  fig2Headline: string;
  fig2Body: string;
  fig3Label: string;
  fig3Headline: string;
  fig3Body: string;
}

export interface TheSettingSlots {
  headline: string;     // ≤6 words / 50 chars; <em>+<br/> allowed
  bodyPara1: string;    // ~60 word italic editorial prose
  bodyPara2: string;    // ~60 word italic editorial prose
  /** Fact-strip values; each ~10-20 chars. AI may set these to "" when no
   *  meaningful data exists — the renderer hides empty cells. */
  factSunValue: string;       // e.g. "South-east"
  factSunCaption: string;     // e.g. "through afternoon"
  factTerrainValue: string;   // e.g. "Coastal flat"
  factTerrainCaption: string; // e.g. "direct sand access"
  factSeaValue: string;       // e.g. "200 m"
  factSeaCaption: string;     // e.g. "open bay"
  factSeasonValue: string;    // e.g. "May — October"
  factSeasonCaption: string;  // e.g. "swimmable"
}

export interface ProvenanceSlots {
  headline: string;       // ≤6 words / 50 chars; <em>+<br/> allowed
  para1: string;          // 60-90 words narrative (architecture / origins)
  para2: string;          // 60-90 words narrative (restoration / present-day)
  para3: string;          // 1-2 sentence landing
  /** Timeline cells; the renderer hides empty ones. Built/restored values
   *  default to property's yearBuilt/yearRestored, AI fills the captions. */
  originallyFor: string;       // e.g. "Private use"
  originallyForCaption: string;
  builtCaption: string;        // small caption under the year
  restoredCaption: string;
  titleCaption: string;        // captions the tenure cell
}

export interface SitePlanSlots {
  headline: string; // 4-8 words; <em> allowed
}

export interface FeatureSlots {
  headline: string; // ≤8 words; <em> allowed
  intro: string;    // 30-60 words, sets up the gallery
  closing: string;  // 25-50 words, wraps up the gallery (appears below photos)
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
  withinReach: WithinReachSlots;
  photoEssay: PhotoEssaySlots;
  theSetting: TheSettingSlots;
  provenance: ProvenanceSlots;
  sitePlan: SitePlanSlots;
  feature: FeatureSlots;
  closing: ClosingSlots;
}

export type PageId = keyof PageSlotSet;

/** Which page-3 variant the user picked for this brochure. "location" is
 *  the default (map + nearby list); the other four are seller-privacy
 *  alternatives that omit any exact-location pin. */
export type Page3Variant =
  | "location"
  | "within-reach"
  | "photo-essay"
  | "the-setting"
  | "provenance";

export const PAGE3_VARIANTS: Page3Variant[] = [
  "location",
  "within-reach",
  "photo-essay",
  "the-setting",
  "provenance",
];

export const PAGE3_VARIANT_LABELS: Record<Page3Variant, string> = {
  "location": "Location & map",
  "within-reach": "Within reach",
  "photo-essay": "Photo essay",
  "the-setting": "The setting",
  "provenance": "Provenance",
};

export const PAGE3_VARIANT_BLURBS: Record<Page3Variant, string> = {
  "location": "Map of the property + nearby places list. Default.",
  "within-reach": "Just the nearby places list — no map pin.",
  "photo-essay": "Three large photos with extended editorial captions.",
  "the-setting": "Atmospheric prose — no places named.",
  "provenance": "History of the property: built, restored, in-hand.",
};

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
