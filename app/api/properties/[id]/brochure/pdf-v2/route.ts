// New per-page brochure renderer. Pipeline:
//   1. Decide which pages this property gets (pages.ts)
//   2. Per page, ask Claude to fill the page's slot schema
//   3. Assembler interpolates slots into the per-page HTML templates +
//      wraps them in the shell
//   4. Puppeteer renders the assembled HTML to a multi-page A4 PDF
//   5. Stream the PDF back as a download
//
// Runs alongside the legacy /pdf endpoint while the per-page architecture
// is incrementally built out. Once all 6 pages exist and this is stable,
// rename pdf-v2 → pdf and delete the React-PDF code.

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { launchBrowser } from "@/lib/brochure/browser";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import { pagesFor } from "@/lib/brochure/pages";
import { allocatePhotos } from "@/lib/brochure/photo-allocator";
import { assembleBrochureHtml } from "@/lib/brochure/assembler";
import {
  draftCoverCopy, draftGlanceCopy, draftLocationCopy, draftSitePlanCopy, draftFeatureCopy, draftClosingCopy,
  draftWithinReachCopy, draftPhotoEssayCopy, draftTheSettingCopy, draftProvenanceCopy,
} from "@/lib/brochure/claude";
import type { PageSlotSet } from "@/lib/brochure/types";

/** Read a local image from /public and inline as a data URI. Puppeteer's
 *  Chromium has no session cookie, so any same-origin HTTP request would
 *  be bounced by the auth middleware. Data URI sidesteps that entirely.
 *  Returns "" if the file is missing (gracefully renders with no image). */
async function localImageDataUri(publicRelPath: string): Promise<string> {
  const p = path.join(process.cwd(), "public", publicRelPath.replace(/^\//, ""));
  try {
    const buf = await fs.readFile(p);
    const ext = (p.split(".").pop() || "jpg").toLowerCase();
    const mime =
      ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
      ext === "gif" ? "image/gif" :
      "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

/** Resolve a property photo URL into something Puppeteer can render.
 *  Local /uploads/... paths → data URI (middleware bypass).
 *  External URLs (Supabase Storage etc.) → pass through; Puppeteer fetches. */
async function resolvePhoto(url: string | undefined): Promise<string> {
  if (!url) return "";
  if (url.startsWith("/")) return localImageDataUri(url);
  return url;
}

/** Fetch a static map PNG centred on the property, zoomed in tight enough
 *  to show the immediate neighbourhood streets. Just the property pin —
 *  no geocoded nearby pins (Mapbox's free geocoder has no granular Kenyan
 *  landmark data, so attempts to pin "Peponi Hotel" etc. landed at generic
 *  city-centre coordinates). The "Within reach" side list carries the
 *  named-places context instead.
 *
 *  Mapbox if MAPBOX_TOKEN set, OSM fallback otherwise.
 *  Returns "" if coordinates missing or all providers fail. */
async function fetchLocalityMap(
  lat: number | undefined,
  lng: number | undefined
): Promise<string> {
  if (lat == null || lng == null) return "";

  // Zoom 15 → ~1.5 km field. Close enough to read nearby street names; wide
  // enough to give a sense of where the property sits.
  const zoom = 15;
  const token = process.env.MAPBOX_TOKEN;
  const styleUrl = process.env.MAPBOX_STYLE_URL;

  if (token) {
    // Default style: outdoors-v12. It renders natural landscape colors —
    // blue water, green vegetation, beige/brown terrain — which suits a
    // property brochure better than the grey/cream light style.
    const stylePath = styleUrl
      ? styleUrl.replace(/^mapbox:\/\/styles\//, "")
      : "mapbox/outdoors-v12";
    const marker = `pin-l+8a3a3a(${lng},${lat})`;
    const url =
      `https://api.mapbox.com/styles/v1/${stylePath}/static/` +
      `${marker}/${lng},${lat},${zoom},0/520x540@2x` +
      `?access_token=${token}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        return `data:image/png;base64,${buf.toString("base64")}`;
      }
    } catch {
      /* fall through */
    }
  }

  const url =
    `https://staticmap.openstreetmap.de/staticmap.php` +
    `?center=${lat},${lng}&zoom=${zoom}&size=640x680` +
    `&markers=${lat},${lng},red-pushpin`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

// Route-segment config. Chromium needs the Node runtime (not Edge). The
// handler fires several Claude calls + a map fetch + a full PDF render, which
// comfortably exceeds Vercel's 10 s default — bump the ceiling so it isn't
// killed mid-render. force-dynamic keeps this from ever being statically
// optimized (it's a per-request POST that launches a browser).
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(user.role, "generateBrochure")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const p = await getProperty(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Optional body — gallery layout sources, listed in priority:
  //   1. galleryTemplateId + galleryOrder — hand-curated template w/ photo order
  //   2. galleryExplicitLayout — full row structure (drag-and-drop legacy)
  //   3. gallerySizes + galleryVariant — per-photo sizes + variant (legacy)
  //   4. nothing — auto-arrangement from photo aspects
  const body = (await req.json().catch(() => ({}))) as {
    galleryOrder?: string[];
    gallerySizes?: Array<"S" | "M" | "L">;
    galleryVariant?: "stacked" | "hero" | "compact";
    galleryExplicitLayout?: {
      rows: Array<{ photos: Array<{ url: string; size: "S" | "M" | "L" }> }>;
    };
    galleryTemplateId?: string;
    /** Page-3 variant choice. "location" = map + nearby (default).
     *  The others are seller-privacy alternatives. */
    page3Variant?: "location" | "within-reach" | "photo-essay" | "the-setting" | "provenance";
  };
  // Default gallery template (used when the editor didn't pick one).
  // 5-pair-trio is the most balanced 2-row layout for the common case
  // of 5 gallery photos; for thinner or denser galleries the editor
  // picks something else.
  const galleryTemplateId: string =
    typeof body.galleryTemplateId === "string" && body.galleryTemplateId
      ? body.galleryTemplateId
      : "5-pair-trio";
  const page3Variant: "location" | "within-reach" | "photo-essay" | "the-setting" | "provenance" =
    body.page3Variant === "within-reach" || body.page3Variant === "photo-essay" ||
    body.page3Variant === "the-setting" || body.page3Variant === "provenance"
      ? body.page3Variant
      : "location";

  // Photo-essay requires at least 9 photos (1 cover + 3 dedicated essay
  // shots + 5 gallery shots, no repeats). The Page3VariantEditor
  // disables the option for properties that don't meet the bar — this
  // is the server-side mirror for direct API callers and stale clients.
  // Without it, a 6-photo property would get a 2-photo page-5 gallery,
  // which reads as broken.
  if (page3Variant === "photo-essay" && (p.photos?.length ?? 0) < 9) {
    return NextResponse.json(
      {
        error:
          `Photo-essay layout needs at least 9 uploaded photos (1 cover + 3 essay shots + 5 gallery shots, no repeats). This property has ${p.photos?.length ?? 0}. Upload more photos or pick a different page-3 variant.`,
      },
      { status: 400 }
    );
  }

  // Within-reach also has a data minimum (the editor enforces it client-
  // side; here's the server-side mirror).
  if (page3Variant === "within-reach" && (p.nearby?.length ?? 0) < 2) {
    return NextResponse.json(
      {
        error:
          `"Within reach" needs at least 2 nearby places recorded. This property has ${p.nearby?.length ?? 0}. Add more nearby places or pick a different page-3 variant.`,
      },
      { status: 400 }
    );
  }
  const explicitOrder = Array.isArray(body.galleryOrder) && body.galleryOrder.length > 0;
  const gallerySizes = Array.isArray(body.gallerySizes)
    ? body.gallerySizes.filter((s): s is "S" | "M" | "L" => s === "S" || s === "M" || s === "L")
    : undefined;
  const galleryVariant =
    body.galleryVariant === "stacked" ||
    body.galleryVariant === "hero" ||
    body.galleryVariant === "compact"
      ? body.galleryVariant
      : undefined;
  const galleryExplicitLayout =
    body.galleryExplicitLayout &&
    Array.isArray(body.galleryExplicitLayout.rows) &&
    body.galleryExplicitLayout.rows.length > 0
      ? body.galleryExplicitLayout
      : undefined;

  const pages = pagesFor(p, page3Variant);
  // Cover guard: photos[0] is the hero, but a landscape image stretched
  // into the portrait A4 cover crops badly. The form blocks landscape
  // photos from being set primary, but pre-existing records (or photos
  // uploaded before dimensions were captured) might still slip through —
  // re-check here. Landscape → drop the hero entirely; the cover falls
  // back to a solid forest-green panel with the vignette + title text.
  const coverDim = p.photoDimensions?.[0];
  // Use the same 10% tolerance as the form's orientation classifier so the
  // brochure and the form agree on what counts as landscape.
  const coverIsLandscape = !!(coverDim && coverDim.w > coverDim.h * 1.10);

  // Allocate property photos to pages via the central allocator. This is
  // the single source of truth — no inline slice math elsewhere. The
  // allocator guarantees no photo appears on more than one page (except
  // the cover, which may optionally repeat on the closing page).
  const allocation = pages.includes("feature")
    ? allocatePhotos(p, {
        page3Variant,
        coverIsLandscape,
        explicitGalleryLayout: galleryExplicitLayout,
        explicitGalleryOrder: explicitOrder ? body.galleryOrder : undefined,
      })
    : allocatePhotos(p, {
        page3Variant,
        coverIsLandscape,
      });

  const galleryUrls = allocation.galleryUrls;
  const galleryCaptionIndices = allocation.galleryCaptionIndices;
  const galleryDims = galleryCaptionIndices.map(
    (idx) => p.photoDimensions?.[idx] ?? null
  );
  const essayUrls = allocation.page3PhotoUrls;
  const provenanceUrl = allocation.provenancePhotoUrl;

  // Floor-plan URLs: prefer the new multi-image array, fall back to the
  // legacy single floor_plan. Cap at 3 (the layout can't show more).
  const floorPlanUrls = pages.includes("sitePlan")
    ? (
        p.floorPlans && p.floorPlans.length > 0
          ? p.floorPlans
          : p.floorPlan
            ? [p.floorPlan]
            : []
      ).slice(0, 3)
    : [];

  const [logo, coverHero, localityMap, fp1, fp2, fp3, essay1, essay2, essay3, provenancePhoto, ...galleryPhotos] = await Promise.all([
    localImageDataUri("sansi-logo.jpg"),
    allocation.coverUrl ? resolvePhoto(allocation.coverUrl) : Promise.resolve(""),
    pages.includes("location")
      ? fetchLocalityMap(p.latitude, p.longitude)
      : Promise.resolve(""),
    floorPlanUrls[0] ? resolvePhoto(floorPlanUrls[0]) : Promise.resolve(""),
    floorPlanUrls[1] ? resolvePhoto(floorPlanUrls[1]) : Promise.resolve(""),
    floorPlanUrls[2] ? resolvePhoto(floorPlanUrls[2]) : Promise.resolve(""),
    essayUrls[0] ? resolvePhoto(essayUrls[0]) : Promise.resolve(""),
    essayUrls[1] ? resolvePhoto(essayUrls[1]) : Promise.resolve(""),
    essayUrls[2] ? resolvePhoto(essayUrls[2]) : Promise.resolve(""),
    provenanceUrl ? resolvePhoto(provenanceUrl) : Promise.resolve(""),
    ...galleryUrls.map((u) => resolvePhoto(u)),
  ]);
  const essayPhotos = [essay1, essay2, essay3].filter(Boolean);
  const floorPlans = [fp1, fp2, fp3].filter(Boolean);
  // Legacy single-value alias for assembler backwards compat.
  const floorPlan = floorPlans[0] ?? "";

  // Draft every included page's slots in parallel.
  const aiSlots: Partial<PageSlotSet> = {};
  await Promise.all(
    pages.map(async (page) => {
      if (page === "cover") aiSlots.cover = await draftCoverCopy(p);
      else if (page === "glance") aiSlots.glance = await draftGlanceCopy(p);
      else if (page === "location") aiSlots.location = await draftLocationCopy(p);
      else if (page === "withinReach") aiSlots.withinReach = await draftWithinReachCopy(p);
      else if (page === "photoEssay") aiSlots.photoEssay = await draftPhotoEssayCopy(p);
      else if (page === "theSetting") aiSlots.theSetting = await draftTheSettingCopy(p);
      else if (page === "provenance") aiSlots.provenance = await draftProvenanceCopy(p);
      else if (page === "sitePlan") aiSlots.sitePlan = await draftSitePlanCopy(p);
      else if (page === "feature") aiSlots.feature = await draftFeatureCopy(p);
      else if (page === "closing") aiSlots.closing = await draftClosingCopy(p);
    })
  );

  const html = await assembleBrochureHtml({
    property: p,
    aiSlots,
    pages,
    images: {
      logo,
      coverHero,
      localityMap,
      floorPlan,
      floorPlans,
      galleryPhotos: galleryPhotos.filter(Boolean),
      galleryDims,
      explicitGalleryOrder: explicitOrder || !!galleryExplicitLayout || !!galleryTemplateId,
      galleryCaptionIndices,
      gallerySizes,
      galleryVariant,
      galleryExplicitLayout,
      galleryTemplateId,
      essayPhotos,
      provenancePhoto,
    },
  });

  // Launch headless Chromium and render. The launcher picks the right
  // browser for the environment (bundled puppeteer locally, @sparticuz/
  // chromium on Vercel) — see lib/brochure/browser.ts.
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    // Wait for Google Fonts to actually finish loading — otherwise the PDF
    // can render with fallback (Times) where Cormorant Garamond should be.
    await page.evaluate(() => (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const filename = `${(p.referenceNumber || "brochure").replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } finally {
    await browser.close();
  }
  } catch (e) {
    const err = e as Error;
    console.error("[brochure/pdf-v2]", err.stack || err.message);
    return NextResponse.json(
      { error: err.message, stack: err.stack?.split("\n").slice(0, 10).join("\n") },
      { status: 500 }
    );
  }
}
