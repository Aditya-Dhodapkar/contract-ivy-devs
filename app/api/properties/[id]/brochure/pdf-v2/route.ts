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
import puppeteer from "puppeteer";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import { pagesFor } from "@/lib/brochure/pages";
import { assembleBrochureHtml } from "@/lib/brochure/assembler";
import { draftCoverCopy, draftGlanceCopy, draftLocationCopy, draftSitePlanCopy, draftFeatureCopy, draftClosingCopy } from "@/lib/brochure/claude";
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

  const pages = pagesFor(p);
  // Cover guard: photos[0] is the hero, but a landscape image stretched
  // into the portrait A4 cover crops badly. The form blocks landscape
  // photos from being set primary, but pre-existing records (or photos
  // uploaded before dimensions were captured) might still slip through —
  // re-check here. Landscape → drop the hero entirely; the cover falls
  // back to a solid forest-green panel with the vignette + title text.
  const coverDim = p.photoDimensions?.[0];
  const coverIsLandscape = !!(coverDim && coverDim.w > coverDim.h * 1.05);
  // Photos[0] is the cover hero; the gallery page consumes photos[1..5].
  const galleryUrls = pages.includes("feature")
    ? (p.photos ?? []).slice(1, 6)
    : [];
  const [logo, coverHero, localityMap, floorPlan, ...galleryPhotos] = await Promise.all([
    localImageDataUri("sansi-logo.jpg"),
    coverIsLandscape ? Promise.resolve("") : resolvePhoto(p.photos?.[0]),
    pages.includes("location")
      ? fetchLocalityMap(p.latitude, p.longitude)
      : Promise.resolve(""),
    pages.includes("sitePlan") ? resolvePhoto(p.floorPlan) : Promise.resolve(""),
    ...galleryUrls.map((u) => resolvePhoto(u)),
  ]);

  // Draft every included page's slots in parallel.
  const aiSlots: Partial<PageSlotSet> = {};
  await Promise.all(
    pages.map(async (page) => {
      if (page === "cover") aiSlots.cover = await draftCoverCopy(p);
      else if (page === "glance") aiSlots.glance = await draftGlanceCopy(p);
      else if (page === "location") aiSlots.location = await draftLocationCopy(p);
      else if (page === "sitePlan") aiSlots.sitePlan = await draftSitePlanCopy(p);
      else if (page === "feature") aiSlots.feature = await draftFeatureCopy(p);
      else if (page === "closing") aiSlots.closing = await draftClosingCopy(p);
    })
  );

  // Dimensions for the gallery photos, aligned to the same slice we resolved.
  // The assembler uses these to score photos against tile aspect ratios.
  const galleryDims = pages.includes("feature")
    ? (p.photoDimensions ?? []).slice(1, 6)
    : [];

  const html = await assembleBrochureHtml({
    property: p,
    aiSlots,
    pages,
    images: {
      logo,
      coverHero,
      localityMap,
      floorPlan,
      galleryPhotos: galleryPhotos.filter(Boolean),
      galleryDims,
    },
  });

  // Launch headless Chromium and render.
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
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
