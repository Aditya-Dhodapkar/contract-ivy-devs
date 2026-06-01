// Brochure HTML assembler. Given a property and a set of per-page Claude
// slot outputs, loads the appropriate per-page templates from
// templates/brochure/, interpolates {{slot}} placeholders, and wraps the
// whole thing in the shell HTML ready for Puppeteer.
//
// Slot interpolation is intentionally Mustache-lite: a flat {{key}} regex.
// No conditionals, no loops, no helpers. If a page needs richer logic,
// solve it before assembly by computing the value in TS.

import { promises as fs } from "fs";
import path from "path";
import type { PropertyRecord, PropertyType } from "@/lib/repo/properties";
import type { PageSlotSet, PageId, CoverSlots, GlanceSlots, LocationSlots, SitePlanSlots, FeatureSlots, ClosingSlots } from "./types";
import { layoutGallery, layoutGalleryExplicit, layoutTemplate, suggestSize, enforceMaxOneLarge, type Size, type Variant, type ExplicitLayout } from "./gallery-layout";
import { getTemplate } from "./templates";

/* ----- helpers used by per-page slot mappers ----- */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** KES number with thousands separators, no currency prefix (the template
 *  has the "KES" label hardcoded). */
function priceNumber(price?: number): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(price);
}

/** Picks the 4 fact cards for page 2 based on property type. Each card is
 *  `{ label, value, detail }`. Missing data shows "—" rather than crashing. */
function factsForType(p: PropertyRecord): Array<{ label: string; value: string; detail: string }> {
  const tenureLabel = p.tenure ? cap(p.tenure) : "—";
  switch (p.propertyType) {
    case "house":
    case "apartment":
      return [
        {
          label: "Bedrooms",
          value: p.bedrooms != null ? String(p.bedrooms) : "—",
          detail: p.bathrooms != null ? `${p.bathrooms} bathroom${p.bathrooms === 1 ? "" : "s"}` : "",
        },
        {
          label: "Built area",
          value: p.builtArea ?? "—",
          detail: p.plotSize ? `Plot: ${p.plotSize}` : "",
        },
        {
          label: "Year built",
          value: p.yearBuilt != null ? String(p.yearBuilt) : "—",
          detail: p.yearRestored ? `Restored ${p.yearRestored}` : "",
        },
        { label: "Tenure", value: tenureLabel, detail: p.shape ?? "" },
      ];
    case "land":
      return [
        { label: "Plot size", value: p.plotSize ?? "—", detail: "" },
        {
          label: "Frontage",
          value: p.plotWidthMeters != null ? `${p.plotWidthMeters} m` : "—",
          detail: p.plotLengthMeters != null ? `${p.plotLengthMeters} m deep` : "",
        },
        { label: "Tenure", value: tenureLabel, detail: "" },
        { label: "Shape", value: p.shape ?? "—", detail: "" },
      ];
    case "commercial":
      return [
        { label: "Floor area", value: p.builtArea ?? "—", detail: p.plotSize ? `Plot: ${p.plotSize}` : "" },
        {
          label: "Year built",
          value: p.yearBuilt != null ? String(p.yearBuilt) : "—",
          detail: p.yearRestored ? `Restored ${p.yearRestored}` : "",
        },
        { label: "Tenure", value: tenureLabel, detail: "" },
        { label: "Configuration", value: p.shape ?? "—", detail: "" },
      ];
    default:
      // unknown type — fall back to plot/built area + tenure
      return [
        { label: "Size", value: p.builtArea ?? p.plotSize ?? "—", detail: "" },
        { label: "Tenure", value: tenureLabel, detail: "" },
        { label: "Location", value: p.city ?? "—", detail: p.country ?? "" },
        { label: "Reference", value: p.referenceNumber, detail: "" },
      ];
  }
}

function useForType(t?: PropertyType): string {
  switch (t) {
    case "house":
    case "apartment":
      return "Residential";
    case "land":
      return "Residential · undeveloped";
    case "commercial":
      return "Commercial";
    default:
      return "—";
  }
}

const TEMPLATE_DIR = path.join(process.cwd(), "templates", "brochure");

/** What the assembler needs from the caller. AI slots are per-page; data
 *  slots come straight from the property record. */
export interface AssemblyInput {
  property: PropertyRecord;
  aiSlots: Partial<PageSlotSet>; // e.g. { cover: { eyebrow, title, sub } }
  pages: PageId[];
  /** Pre-resolved image sources (data URI or external URL). Computed by the
   *  route so the assembler stays IO-free for everything except template
   *  loading. */
  images: {
    logo: string;        // brand logo
    coverHero: string;   // primary photo for the cover background
    localityMap: string; // static-map image for the location page (or "")
    floorPlan: string;   // resolved site/floor plan image for page 4 (or "")
    galleryPhotos: string[]; // resolved gallery photos for page 5 (already in tile order if explicit)
    /** Pixel dimensions aligned to galleryPhotos. May contain undefined/null
     *  entries for photos uploaded before dimension capture. */
    galleryDims: Array<{ w: number; h: number } | null | undefined>;
    /** True when galleryPhotos came from the user's explicit layout choice
     *  (in which case order = identity); false when the route fell back to
     *  the default photos.slice(1, 6) and we should auto-arrange. */
    explicitGalleryOrder?: boolean;
    /** When explicitGalleryOrder is true: for each gallery photo, the index
     *  in the property's `photos` array that the URL came from. Used to look
     *  up the per-photo caption (which is stored aligned to `photos`). */
    galleryCaptionIndices?: number[];
    /** Optional per-photo tile size choices, aligned to galleryPhotos. When
     *  omitted, suggestSize() picks a sensible default per photo. */
    gallerySizes?: Size[];
    /** Optional layout variant — which row-grouping strategy to use. */
    galleryVariant?: Variant;
    /** Optional explicit layout from the drag-and-drop editor / AI designer.
     *  When provided, overrides gallerySizes/galleryVariant — the assembler
     *  renders exactly the rows specified. */
    galleryExplicitLayout?: ExplicitLayout;
    /** Optional template id (e.g. "5-hero-quartet"). Highest priority: when
     *  provided, the assembler renders the gallery using that row partition
     *  with auto-computed tile dimensions matching photo aspects. */
    galleryTemplateId?: string;
  };
}

// Gallery slot geometry + assignment now lives in ./gallery-layout.ts so
// the client editor can share the same logic when previewing arrangements.

/** Builds the flat {{key}} → value map for one page's interpolation pass.
 *  Data fields shared across every page live at the top; per-page AI slot
 *  values are scoped by page id. */
function flatSlotsFor(page: PageId, input: AssemblyInput, pageNumber: number, pageTotal: number): Record<string, string> {
  const { property: p, aiSlots, images } = input;

  const base: Record<string, string> = {
    title: p.title ?? "Untitled",
    referenceNumber: p.referenceNumber ?? "—",
    location: [p.city, p.country].filter(Boolean).join(", ") || "—",
    coverDate: new Date().toLocaleString("en-GB", { month: "long", year: "numeric" }),
    currentYear: String(new Date().getFullYear()),
    logoUrl: images.logo,
    pageNumber: String(pageNumber).padStart(2, "0"),
    pageTotal: String(pageTotal).padStart(2, "0"),
  };

  switch (page) {
    case "cover": {
      const c = (aiSlots.cover ?? {}) as Partial<CoverSlots>;
      return {
        ...base,
        coverEyebrow: c.eyebrow ?? "",
        coverTitle: c.title ?? base.title,
        coverSub: c.sub ?? "",
        coverHero: images.coverHero,
      };
    }
    case "location": {
      const loc = (aiSlots.location ?? {}) as Partial<LocationSlots>;
      // Render the nearby <li> list straight from data (no Claude in this part).
      // Each row: number + (place + optional description) + distance.
      const nearbyItems = (p.nearby ?? [])
        .filter((n) => n.place || n.distance || n.description)
        .map((n, i) => {
          const num = String(i + 1).padStart(2, "0");
          const m = (n.distance || "").trim().match(/^([0-9.,]+)\s*(.*)$/);
          const distVal = m?.[1] ?? n.distance ?? "—";
          const distUnit = m?.[2] ?? "";
          const descHtml = n.description
            ? `<span>${escapeHtml(n.description)}</span>`
            : "";
          return `<li><span class="n">${num}</span><span class="name">${escapeHtml(n.place || "—")}${descHtml}</span><span class="dist">${escapeHtml(distVal)}<small>${escapeHtml(distUnit)}</small></span></li>`;
        })
        .join("\n          ");

      const coordsLine =
        p.latitude != null && p.longitude != null
          ? `${p.latitude.toFixed(4)}°, ${p.longitude.toFixed(4)}°  ·  ${base.location}`
          : base.location;

      return {
        ...base,
        locationHeadline: loc.headline ?? "",
        locationIntro: loc.intro ?? "",
        locationClosing: loc.closing ?? "",
        localityMap: images.localityMap,
        coordsLine,
        mapScale: "≈ 1.5 km across",
        nearbyItems: nearbyItems || `<li style="color:var(--ink-mute)"><span class="n">—</span><span class="name">No nearby places recorded.</span><span class="dist"></span></li>`,
      };
    }
    case "sitePlan": {
      const sp = (aiSlots.sitePlan ?? {}) as Partial<SitePlanSlots>;
      // Row helpers — each row is `[label, primaryValue, optionalDetail]`.
      // Falsy primaryValue → row is skipped, so the table shrinks naturally
      // for properties that don't have e.g. topography filled in.
      const rows: Array<[string, string, string?]> = [];
      const push = (label: string, value: string | undefined | null, detail?: string) => {
        if (value && value.toString().trim()) rows.push([label, String(value).trim(), detail]);
      };
      const addr = [p.title, [p.city, p.country].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(" · ");
      push("Address", addr);
      push("Tenure", p.tenure ? cap(p.tenure) : undefined);
      push(
        "Plot",
        p.plotSize,
        p.plotWidthMeters && p.plotLengthMeters
          ? `${p.plotWidthMeters} m × ${p.plotLengthMeters} m`
          : undefined
      );
      push("Built area", p.builtArea, p.yearBuilt ? `Built ${p.yearBuilt}` : undefined);
      const bedBath =
        p.bedrooms != null
          ? `${p.bedrooms} bedroom${p.bedrooms === 1 ? "" : "s"}` +
            (p.bathrooms != null ? ` · ${p.bathrooms} bath${p.bathrooms === 1 ? "" : "s"}` : "")
          : undefined;
      push("Configuration", bedBath);
      push("Shape", p.shape);
      push("Topography", p.topography);
      push("Boundary", p.boundary);
      push("Services", p.services);
      push(
        "Use",
        p.propertyType === "house" || p.propertyType === "apartment"
          ? "Residential"
          : p.propertyType === "land"
            ? "Residential · undeveloped"
            : p.propertyType === "commercial"
              ? "Commercial"
              : undefined
      );
      push("Sale", p.saleTerms, p.price ? `${priceNumber(p.price)} KES` : undefined);

      const particularsRows = rows
        .map(
          ([k, v, detail]) =>
            `<tr><td class="k">${escapeHtml(k)}</td><td class="v">${escapeHtml(v)}` +
            (detail ? `<em>${escapeHtml(detail)}</em>` : "") +
            `</td></tr>`
        )
        .join("\n          ");

      const floorPlanImg = images.floorPlan
        ? `<img class="siteplan-img" src="${escapeHtml(images.floorPlan)}" alt="Site / floor plan" />`
        : `<div class="siteplan-empty">Site / floor plan available on request.</div>`;

      return {
        ...base,
        landHeadline: sp.headline ?? "",
        floorPlanImg,
        particularsRows,
      };
    }
    case "feature": {
      const f = (aiSlots.feature ?? {}) as Partial<FeatureSlots>;
      // Row-based masonry. Tile aspect = photo aspect, always — no crops,
      // no whitespace. Two paths to a layout:
      //   1. EXPLICIT (drag-and-drop or AI designer): caller hands us a
      //      complete row structure; we render it 1:1.
      //   2. AUTO: we build the rows from per-photo sizes + a variant
      //      grouping strategy.
      const photoUrls = images.galleryPhotos.slice(0, 5);
      const photoDims = images.galleryDims.slice(0, 5);
      const captions = p.photoCaptions ?? [];

      const aspects = photoUrls.map((_, i) => {
        const d = photoDims[i];
        return d && d.w && d.h ? d.w / d.h : 1.0;
      });

      const aspectByUrl: Record<string, number> = {};
      photoUrls.forEach((u, i) => (aspectByUrl[u] = aspects[i]));

      const rawSizes: Size[] = photoUrls.map((_, i) => {
        const provided = images.gallerySizes?.[i];
        return provided ?? suggestSize(aspects[i], i);
      });
      const sizes = enforceMaxOneLarge(rawSizes);
      const variant: Variant = images.galleryVariant ?? "stacked";

      // Caption index lookup (see explicit-order logic).
      const captionIndexFor = (galleryIdx: number): number =>
        images.explicitGalleryOrder
          ? (images.galleryCaptionIndices?.[galleryIdx] ?? -1)
          : galleryIdx + 1;

      // Map url → its index in photoUrls so we can recover caption indices
      // even after the variant has reshuffled photos into rows.
      const indexByUrl = new Map<string, number>();
      photoUrls.forEach((u, i) => indexByUrl.set(u, i));

      // Priority order: template > explicit layout > size+variant fallback.
      const templateRecord = images.galleryTemplateId
        ? getTemplate(images.galleryTemplateId)
        : undefined;
      const rows = templateRecord
        ? layoutTemplate(
            templateRecord,
            photoUrls.map((url, i) => ({ url, aspect: aspects[i] }))
          )
        : images.galleryExplicitLayout
          ? layoutGalleryExplicit(images.galleryExplicitLayout, aspectByUrl)
          : layoutGallery(
              photoUrls.map((url, i) => ({ url, aspect: aspects[i], size: sizes[i] })),
              variant
            );

      // Running caption counter (1, 2, 3…) so the caption label reflects
      // visual reading order, not the photos[] index.
      let visualIdx = 0;
      const galleryRows = rows
        .map((row) => {
          const items = row.photos
            .map((p2) => {
              const origIdx = indexByUrl.get(p2.url) ?? -1;
              const capIdx = origIdx >= 0 ? captionIndexFor(origIdx) : -1;
              const cap = capIdx >= 0 ? (captions[capIdx] ?? "").trim() : "";
              visualIdx++;
              const num = String(visualIdx).padStart(2, "0");
              const dataCap = cap ? `${num} — ${cap}` : "";
              const widthCss = `width: ${p2.widthPct.toFixed(3)}%;`;
              return (
                `<div class="ph" data-cap="${escapeHtml(dataCap)}" style="${widthCss}">` +
                `<img src="${escapeHtml(p2.url)}" alt="" />` +
                `</div>`
              );
            })
            .join("");
          return `<div class="gallery-row" style="height: ${row.height.toFixed(1)}px;">${items}</div>`;
        })
        .join("\n      ");

      return {
        ...base,
        featureHeadline: f.headline ?? "",
        featureIntro: f.intro ?? "",
        featureClosing: f.closing ?? "",
        galleryGridClass: "masonry",
        galleryTiles: galleryRows,
      };
    }
    case "closing": {
      const c = (aiSlots.closing ?? {}) as Partial<ClosingSlots>;
      // Split AI terms on blank lines into separate <p> tags so paragraph
      // breaks render. Single-paragraph output stays a single <p>.
      const termsParas = (c.terms ?? "")
        .split(/\n\s*\n/)
        .map((para) => para.trim())
        .filter(Boolean)
        .map((para) => `<p>${escapeHtml(para)}</p>`)
        .join("\n          ") ||
        `<p>Terms available on application.</p>`;
      return {
        ...base,
        closingHeadline: c.headline ?? "",
        termsParas,
      };
    }
    case "glance": {
      const g = (aiSlots.glance ?? {}) as Partial<GlanceSlots>;
      const facts = factsForType(p);
      const sizeText = p.builtArea
        ? `${p.builtArea}${p.plotSize ? ` · plot ${p.plotSize}` : ""}`
        : p.plotSize ?? "—";
      return {
        ...base,
        priceFormatted: priceNumber(p.price),
        glanceHeadline: g.headline ?? "",
        priceTagline: g.priceTagline ?? "",
        blurb: g.blurb ?? "",
        glanceBodyPara1: g.bodyPara1 ?? "",
        glanceBodyPara2: g.bodyPara2 ?? "",
        // Type-aware 4-fact block
        fact1Label: facts[0]?.label ?? "",
        fact1Value: facts[0]?.value ?? "",
        fact1Detail: facts[0]?.detail ?? "",
        fact2Label: facts[1]?.label ?? "",
        fact2Value: facts[1]?.value ?? "",
        fact2Detail: facts[1]?.detail ?? "",
        fact3Label: facts[2]?.label ?? "",
        fact3Value: facts[2]?.value ?? "",
        fact3Detail: facts[2]?.detail ?? "",
        fact4Label: facts[3]?.label ?? "",
        fact4Value: facts[3]?.value ?? "",
        fact4Detail: facts[3]?.detail ?? "",
        // Keylist (7 lines)
        keyLocation: [p.city, p.country].filter(Boolean).join(", ") || "—",
        keyTenure: p.tenure ? cap(p.tenure) : "—",
        keySize: sizeText,
        keyShape: p.shape ?? "—",
        keyUse: useForType(p.propertyType),
        keyCondition: p.siteCondition ?? "—",
        keySale: p.saleTerms ?? "—",
      };
    }
  }
  return base;
}

/** Replaces every {{key}} in `tpl` with the matching `vars` value.
 *  Unknown keys are left in place (visible) — easier to spot a missing
 *  slot during development than to silently render an empty string. */
function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (full, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : full;
  });
}

export async function assembleBrochureHtml(input: AssemblyInput): Promise<string> {
  const shellPath = path.join(TEMPLATE_DIR, "_shell.html");
  const shell = await fs.readFile(shellPath, "utf8");

  const total = input.pages.length;
  const pageHtmls = await Promise.all(
    input.pages.map(async (page, i) => {
      const tplPath = path.join(TEMPLATE_DIR, `${pageFilename(page)}.html`);
      const tpl = await fs.readFile(tplPath, "utf8");
      return interpolate(tpl, flatSlotsFor(page, input, i + 1, total));
    })
  );

  // First-pass shell-level slots (title for the <title> tag).
  return interpolate(
    shell.replace("{{PAGES}}", pageHtmls.join("\n")),
    {
      title: input.property.title ?? "Property",
    }
  );
}

/** Maps a PageId to its template filename stem. */
function pageFilename(page: PageId): string {
  switch (page) {
    case "cover":
      return "01-cover";
    case "glance":
      return "02-glance";
    case "location":
      return "03-location";
    case "sitePlan":
      return "04-site-plan";
    case "feature":
      return "05-feature";
    case "closing":
      return "06-closing";
  }
}
