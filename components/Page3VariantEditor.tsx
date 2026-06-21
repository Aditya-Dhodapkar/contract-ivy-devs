"use client";

// Page-3 variant picker. First asks whether the seller wants the locality
// map on page 3 (the default brochure behaviour). If she says no, surfaces
// the 4 alternative templates as cards: Within reach, Photo essay, The
// setting, Provenance.
//
// Photo essay needs ≥4 total photos (cover + 3 essay shots). When the
// property is below that threshold the card is rendered but disabled.

import { useEffect, useState } from "react";

export type Page3Variant =
  | "location"
  | "within-reach"
  | "photo-essay"
  | "the-setting"
  | "provenance";

const ALTERNATIVES: Array<{
  id: Exclude<Page3Variant, "location">;
  label: string;
  blurb: string;
  detail: string;
  requiresPhotos?: number;
}> = [
  {
    id: "within-reach",
    label: "Within reach",
    blurb: "Big editorial list of nearby places — no map pin.",
    detail: "Same nearby data, no map. Lets buyers know the neighbourhood without the exact address.",
  },
  {
    id: "photo-essay",
    label: "Photo essay",
    blurb: "Three large photos with extended captions.",
    detail: "Magazine-style spread. Uses photos 2-4 (the first three after the cover).",
    requiresPhotos: 4,
  },
  {
    id: "the-setting",
    label: "The setting",
    blurb: "Atmospheric prose. Zero places named.",
    detail: "Pure sense-of-place writing — the light, the wind, the terrain. For maximum-privacy listings.",
  },
  {
    id: "provenance",
    label: "Provenance",
    blurb: "The property's history: built, restored, in-hand.",
    detail: "Heritage-placard treatment. Best for restored, historic, or architecturally-significant properties.",
  },
];

export interface Page3VariantEditorProps {
  /** Total property photo count, including cover. */
  totalPhotos: number;
  /** Whether the property has any `nearby` entries — Within reach needs ≥2. */
  nearbyCount: number;
  /** Whether the property has coordinates — the map option needs them. */
  hasCoordinates: boolean;
  onChange: (variant: Page3Variant) => void;
}

export function Page3VariantEditor({
  totalPhotos,
  nearbyCount,
  hasCoordinates,
  onChange,
}: Page3VariantEditorProps) {
  // Default: show the map (current behaviour).
  const [showMap, setShowMap] = useState(true);
  const [altId, setAltId] = useState<Exclude<Page3Variant, "location">>("within-reach");

  // Bubble up the resolved choice.
  useEffect(() => {
    onChange(showMap ? "location" : altId);
  }, [showMap, altId, onChange]);

  // Photo-essay uses 3 photos that must NOT be reused in the page-5
  // gallery (no shot should appear on both pages). With page 5 needing
  // 5 photos minimum and a cover taking 1, that floor is 9 total.
  const PHOTO_ESSAY_MIN = 9;

  function isAltAvailable(id: Exclude<Page3Variant, "location">): boolean {
    if (id === "photo-essay" && totalPhotos < PHOTO_ESSAY_MIN) return false;
    if (id === "within-reach" && nearbyCount < 2) return false;
    return true;
  }

  return (
    <section className="border border-hairline/15 bg-paper p-6">
      <p className="text-eyebrow uppercase text-ash">Page 3 (location)</p>
      <p className="mt-1 text-sm text-ink-mute">
        Page 3 is the location page. Show the map of the property, or use
        one of four alternatives that hide the exact pin.
      </p>

      {/* Photo-budget summary — surfaces the requirement up-front so she
          understands why "Photo essay" might be disabled before she clicks
          around. Independent of variant choice. */}
      <div className="mt-4 border-l-2 border-gold-deep/40 bg-ivory-deep/40 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wider text-ash">
          Photo budget
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          This property has{" "}
          <span className="font-semibold text-ink">{totalPhotos}</span> photo
          {totalPhotos === 1 ? "" : "s"} uploaded.
          {totalPhotos < PHOTO_ESSAY_MIN ? (
            <>
              {" "}Add{" "}
              <span className="font-semibold text-ink">
                {PHOTO_ESSAY_MIN - totalPhotos} more
              </span>{" "}
              to unlock the <em>Photo essay</em> page-3 variant (which
              needs 3 unique shots beyond the cover and the 5-photo page-5
              gallery — {PHOTO_ESSAY_MIN} total, no repeats).
            </>
          ) : (
            <>
              {" "}Enough to use every variant, including <em>Photo essay</em>
              (which gets its own 3 shots, distinct from the page-5 gallery).
            </>
          )}
        </p>
      </div>

      {/* Map yes/no toggle */}
      <div className="mt-5 inline-flex border border-hairline/25">
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className={
            "px-5 py-2 text-eyebrow uppercase transition-colors " +
            (showMap
              ? "bg-gold-deep text-paper"
              : "bg-paper text-ink-mute hover:bg-ivory-deep")
          }
        >
          ✓ Show map
        </button>
        <button
          type="button"
          onClick={() => setShowMap(false)}
          className={
            "border-l border-hairline/25 px-5 py-2 text-eyebrow uppercase transition-colors " +
            (!showMap
              ? "bg-gold-deep text-paper"
              : "bg-paper text-ink-mute hover:bg-ivory-deep")
          }
        >
          Hide map
        </button>
      </div>

      {showMap ? (
        hasCoordinates ? (
          <p className="mt-3 text-xs text-ash">
            Default. Page 3 shows the locality map + "Within reach" nearby list.
          </p>
        ) : (
          <div className="mt-3 border-l-2 border-red-400 bg-red-50/60 px-3 py-2.5 text-xs text-red-700">
            <p className="font-semibold">No coordinates on this property.</p>
            <p className="mt-1">
              The map needs a latitude &amp; longitude. Add them on the
              property&rsquo;s edit page, then come back — or choose
              &ldquo;Hide map&rdquo; and pick a no-map page 3 below. You can&rsquo;t
              generate with the map until coordinates are set.
            </p>
          </div>
        )
      ) : (
        <div className="mt-5">
          <p className="text-eyebrow uppercase text-ash">Pick an alternative</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ALTERNATIVES.map((opt) => {
              const available = isAltAvailable(opt.id);
              const active = available && opt.id === altId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => available && setAltId(opt.id)}
                  disabled={!available}
                  className={
                    "flex flex-col gap-1 border p-4 text-left transition " +
                    (active
                      ? "border-gold-deep bg-gold-deep/5 ring-2 ring-gold-deep/30"
                      : available
                        ? "border-hairline/25 hover:border-hairline/50"
                        : "cursor-not-allowed border-hairline/15 opacity-50")
                  }
                  title={
                    available
                      ? opt.detail
                      : opt.id === "photo-essay"
                        ? `Needs ${PHOTO_ESSAY_MIN} photos total (1 cover + 3 unique essay shots + 5 page-5 gallery)`
                        : opt.id === "within-reach"
                          ? "Needs at least 2 nearby places recorded"
                          : ""
                  }
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        "text-eyebrow uppercase " +
                        (active ? "text-gold-deep" : "text-ink-mute")
                      }
                    >
                      {opt.label}
                    </span>
                    {active && (
                      <span className="text-eyebrow uppercase text-gold-deep">✓ selected</span>
                    )}
                  </div>
                  <p className="text-sm text-ink-soft">{opt.blurb}</p>
                  <p className="mt-1 text-[11px] text-ash">{opt.detail}</p>
                  {!available && (
                    <p className="mt-2 text-[11px] italic text-red-700">
                      {opt.id === "photo-essay"
                        ? `Add ${PHOTO_ESSAY_MIN - totalPhotos} more photo${PHOTO_ESSAY_MIN - totalPhotos === 1 ? "" : "s"} (needs ${PHOTO_ESSAY_MIN} total: 1 cover + 3 here + 5 for page 5 gallery).`
                        : opt.id === "within-reach"
                          ? `Add at least ${2 - nearbyCount} more nearby place to enable this.`
                          : "Unavailable."}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
