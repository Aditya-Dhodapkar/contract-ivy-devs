// PDF template via @react-pdf/renderer. Re-implements the reference
// brochure design (Rosslyn Lone Tree) as a fixed structure with editorial
// slots filled at render time. Stays consistent across every property; only
// data + Claude-generated slots vary.
//
// Pages: 1) Cover  2) Introduction  3) Property at a glance
//        4) Site plan & particulars  5) Feature  6) Photographs
//        7) Terms & enquiries
// Site-plan page is conditionally shown when plot dimensions exist AND
// showPlotOnBrochure is true.

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Svg,
  Rect,
  Path,
  Line,
} from "@react-pdf/renderer";
import type { PropertyRecord } from "@/lib/repo/properties";
import type { BrochureSlots } from "./types";

/* ----------------------------- Fonts ----------------------------- */
// Using react-pdf's built-in fonts only ("Times-Roman" for the serif voice,
// "Courier" for monospace). The Google Fonts CDN's static-TTF URLs are
// versioned and frequently 404 against guessed paths; bundling Cormorant
// Garamond + JetBrains Mono as local TTFs under public/fonts/ is the polish
// step once we have her brand assets in hand. For now: ship a clean PDF.

/* --------------------------- Palette --------------------------- */

const C = {
  paper:   "#f3efe6",
  paper2:  "#ebe5d7",
  ink:     "#1c1f1a",
  inkSoft: "#4a4d44",
  inkMute: "#8a8a7e",
  rule:    "#c9c2b1",
  accent:  "#2d3b2c", // deep forest
  accent2: "#6b5a3e", // warm bronze
  berry:   "#8a3a3a",
};

/* --------------------------- Styles --------------------------- */

const s = StyleSheet.create({
  page: {
    backgroundColor: C.paper,
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Times-Roman",
    color: C.ink,
    fontSize: 12,
  },
  runhead: {
    position: "absolute",
    top: 28,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Courier",
    fontSize: 9,
    color: C.inkMute,
    letterSpacing: 1.4,
  },
  runfoot: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Courier",
    fontSize: 9,
    color: C.inkMute,
    letterSpacing: 1.4,
  },
  eyebrow: {
    fontFamily: "Courier",
    fontSize: 9,
    letterSpacing: 2,
    color: C.accent,
    textTransform: "uppercase",
  },
  h1: {
    fontFamily: "Times-Roman",
    fontWeight: 300,
    fontSize: 44,
    lineHeight: 1.02,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: "Times-Roman",
    fontWeight: 400,
    fontSize: 22,
    marginBottom: 8,
  },
  bodyText: {
    fontFamily: "Times-Roman",
    fontSize: 13,
    lineHeight: 1.55,
    color: C.inkSoft,
  },
  small: {
    fontFamily: "Times-Roman",
    fontSize: 11,
    color: C.inkSoft,
    lineHeight: 1.5,
  },
  mono: {
    fontFamily: "Courier",
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: C.inkMute,
    textTransform: "uppercase",
  },
  italic: { fontStyle: "italic", color: C.accent },
  hairline: { borderBottomWidth: 0.6, borderBottomColor: C.rule, marginVertical: 4 },
});

/* --------------------------- Helpers --------------------------- */

const fmtKes = (n?: number) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        maximumFractionDigits: 0,
      }).format(n);

function Runhead({ p, label }: { p: PropertyRecord; label: string }) {
  return (
    <View style={s.runhead} fixed>
      <Text>
        {(p.title || "Property").toUpperCase()}  ·  {label.toUpperCase()}
      </Text>
      <Text>{p.referenceNumber}</Text>
    </View>
  );
}
function Runfoot({ pageNumber, total }: { pageNumber: number; total: number }) {
  return (
    <View style={s.runfoot} fixed>
      <Text>SANSI AFRICA  ·  PRIVATE & CONFIDENTIAL</Text>
      <Text>
        {String(pageNumber).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </Text>
    </View>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        borderTopWidth: 0.6,
        borderTopColor: C.rule,
        paddingVertical: 7,
      }}
    >
      <Text style={[s.mono, { width: "38%" }]}>{k}</Text>
      <Text style={[s.bodyText, { flex: 1, color: C.ink }]}>{v}</Text>
    </View>
  );
}

/* --------------------------- Pages --------------------------- */

function CoverPage({
  p,
  slots,
  total,
  logoSrc,
}: {
  p: PropertyRecord;
  slots: BrochureSlots;
  total: number;
  logoSrc?: string;
}) {
  const hero = p.photos?.[0];
  return (
    <Page size="A4" style={s.page}>
      <Runhead p={p} label="Cover" />
      {hero ? (
        <Image
          src={hero}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: "38%",
            width: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}
      <View
        style={{
          position: "absolute",
          left: 56,
          right: 56,
          bottom: 80,
        }}
      >
        <Text style={s.eyebrow}>{p.referenceNumber}</Text>
        <Text style={[s.h1, { marginTop: 10, fontSize: 56 }]}>{p.title || "Untitled"}</Text>
        <Text style={[s.mono, { marginTop: 14, color: C.inkSoft }]}>
          {[p.city, p.country].filter(Boolean).join(", ").toUpperCase()}
        </Text>
        <Text style={[s.bodyText, { marginTop: 16, color: C.ink, fontStyle: "italic" }]}>
          {slots.coverTagline}
        </Text>
      </View>
      {logoSrc ? (
        <Image
          src={logoSrc}
          style={{ position: "absolute", top: 36, right: 56, width: 60, height: 60, objectFit: "contain" }}
        />
      ) : null}
      <Runfoot pageNumber={1} total={total} />
    </Page>
  );
}

function IntroPage({
  p,
  slots,
  pageNumber,
  total,
}: {
  p: PropertyRecord;
  slots: BrochureSlots;
  pageNumber: number;
  total: number;
}) {
  return (
    <Page size="A4" style={s.page}>
      <Runhead p={p} label="Introduction" />
      <Text style={s.eyebrow}>§ I — Introduction</Text>
      <Text style={[s.h1, { marginTop: 10 }]}>{slots.introHeadline}</Text>
      <Text style={[s.bodyText, { marginTop: 20, fontSize: 15, lineHeight: 1.65, maxWidth: "82%" }]}>
        {slots.introLede}
      </Text>
      {p.description ? (
        <Text style={[s.bodyText, { marginTop: 18, maxWidth: "82%" }]}>{p.description}</Text>
      ) : null}
      <Runfoot pageNumber={pageNumber} total={total} />
    </Page>
  );
}

function PropertyGlancePage({
  p,
  slots,
  pageNumber,
  total,
}: {
  p: PropertyRecord;
  slots: BrochureSlots;
  pageNumber: number;
  total: number;
}) {
  const isHouse = p.propertyType === "house" || p.propertyType === "apartment";
  return (
    <Page size="A4" style={s.page}>
      <Runhead p={p} label="The property" />
      <Text style={s.eyebrow}>§ II — The Property</Text>
      <Text style={[s.h1, { marginTop: 10 }]}>{slots.propertyHeadline}</Text>

      <View style={{ flexDirection: "row", marginTop: 32, gap: 32 }}>
        <View style={{ flex: 1.3 }}>
          <Text style={s.h2}>Particulars.</Text>
          <KV k="Reference" v={p.referenceNumber} />
          <KV k="Location" v={[p.city, p.country].filter(Boolean).join(", ")} />
          <KV k="Type" v={p.propertyType} />
          <KV k="Price" v={fmtKes(p.price)} />
          {isHouse ? <KV k="Bedrooms" v={p.bedrooms} /> : null}
          {isHouse ? <KV k="Bathrooms" v={p.bathrooms} /> : null}
          <KV k="Plot size" v={p.plotSize} />
          <KV k="Built area" v={p.builtArea} />
          <KV k="Facing" v={p.facingDirection} />
          <KV k="Year built" v={p.yearBuilt} />
          {p.yearRestored ? <KV k="Year restored" v={p.yearRestored} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          {p.highlights && p.highlights.length > 0 ? (
            <View style={{ marginBottom: 22 }}>
              <Text style={s.h2}>Highlights.</Text>
              {p.highlights.map((h) => (
                <Text key={h} style={[s.bodyText, { marginTop: 4 }]}>
                  · {h}
                </Text>
              ))}
            </View>
          ) : null}
          {p.amenities && p.amenities.length > 0 ? (
            <View>
              <Text style={s.h2}>Amenities.</Text>
              {p.amenities.map((a) => (
                <Text key={a} style={[s.bodyText, { marginTop: 4 }]}>
                  · {a}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      <Runfoot pageNumber={pageNumber} total={total} />
    </Page>
  );
}

function SitePlanPage({
  p,
  slots,
  pageNumber,
  total,
}: {
  p: PropertyRecord;
  slots: BrochureSlots;
  pageNumber: number;
  total: number;
}) {
  const w = p.plotWidthMeters!;
  const h = p.plotLengthMeters!;
  // Scale so the rectangle fits in a 280×320 canvas with padding.
  const maxW = 220;
  const maxH = 260;
  const scale = Math.min(maxW / w, maxH / h);
  const rectW = w * scale;
  const rectH = h * scale;
  const cx = 160;
  const cy = 200;

  return (
    <Page size="A4" style={s.page}>
      <Runhead p={p} label="Site plan" />
      <Text style={s.eyebrow}>§ III — The Land</Text>
      <Text style={[s.h1, { marginTop: 10 }]}>{slots.landHeadline}</Text>

      <View style={{ flexDirection: "row", marginTop: 28, gap: 24 }}>
        <View style={{ flex: 1.3, backgroundColor: C.paper2, padding: 18 }}>
          <Text style={[s.mono, { color: C.inkMute }]}>Fig. — Indicative site plan</Text>
          <Svg viewBox="0 0 320 380" width="100%" height={300} style={{ marginTop: 12 }}>
            {/* grid */}
            {Array.from({ length: 16 }).map((_, i) => (
              <Line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={380} stroke={C.rule} strokeWidth={0.3} />
            ))}
            {Array.from({ length: 19 }).map((_, i) => (
              <Line key={`h${i}`} x1={0} y1={i * 20} x2={320} y2={i * 20} stroke={C.rule} strokeWidth={0.3} />
            ))}
            {/* plot rectangle */}
            <Rect
              x={cx - rectW / 2}
              y={cy - rectH / 2}
              width={rectW}
              height={rectH}
              fill={C.paper}
              stroke={C.accent}
              strokeWidth={1.6}
            />
            {/* N arrow */}
            <Line x1={cx} y1={cy - rectH / 2 - 30} x2={cx} y2={cy - rectH / 2 - 10} stroke={C.inkSoft} strokeWidth={1} />
            <Path
              d={`M${cx - 4},${cy - rectH / 2 - 14} L${cx},${cy - rectH / 2 - 22} L${cx + 4},${cy - rectH / 2 - 14} Z`}
              fill={C.inkSoft}
            />
          </Svg>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={s.mono}>{w} M (W)</Text>
            <Text style={s.mono}>{h} M (L)</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>Land &amp; tenure.</Text>
          <KV k="Plot size" v={p.plotSize} />
          <KV k="Dimensions" v={`${w} m × ${h} m`} />
          <KV k="Facing" v={p.facingDirection} />
          <KV k="Location" v={[p.city, p.country].filter(Boolean).join(", ")} />
        </View>
      </View>
      <Text style={[s.small, { marginTop: 14, color: C.inkMute, maxWidth: "90%" }]}>
        Site plan indicative, not to survey accuracy. Final dimensions to be confirmed against
        registered titles and surveyor's report.
      </Text>
      <Runfoot pageNumber={pageNumber} total={total} />
    </Page>
  );
}

function FeaturePage({
  p,
  slots,
  pageNumber,
  total,
}: {
  p: PropertyRecord;
  slots: BrochureSlots;
  pageNumber: number;
  total: number;
}) {
  const heroIdx = Math.min(1, (p.photos?.length ?? 1) - 1);
  const hero = p.photos?.[heroIdx];
  return (
    <Page size="A4" style={s.page}>
      <Runhead p={p} label="Feature" />
      <Text style={s.eyebrow}>§ IV — Feature</Text>
      <Text style={[s.h1, { marginTop: 10 }]}>{slots.featureHeadline}</Text>
      <Text style={[s.bodyText, { marginTop: 18, fontSize: 14, lineHeight: 1.65, maxWidth: "82%" }]}>
        {slots.featureBody}
      </Text>
      {hero ? (
        <Image
          src={hero}
          style={{
            marginTop: 26,
            width: "100%",
            height: 420,
            objectFit: "cover",
          }}
        />
      ) : null}
      <Runfoot pageNumber={pageNumber} total={total} />
    </Page>
  );
}

function GalleryPage({
  p,
  pageNumber,
  total,
}: {
  p: PropertyRecord;
  pageNumber: number;
  total: number;
}) {
  // Up to 6 supporting photos beyond the cover + feature ones used elsewhere.
  const photos = (p.photos ?? []).slice(0, 6);
  return (
    <Page size="A4" style={s.page}>
      <Runhead p={p} label="Photographs" />
      <Text style={s.eyebrow}>§ V — Photographs</Text>
      <Text style={[s.h1, { marginTop: 10 }]}>Photographs.</Text>
      <View
        style={{
          marginTop: 24,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {photos.map((url, i) => (
          <View key={i} style={{ width: "49%", height: 230 }}>
            <Image src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <Text style={[s.mono, { marginTop: 4 }]}>
              {String(i + 1).padStart(2, "0")}
            </Text>
          </View>
        ))}
      </View>
      <Runfoot pageNumber={pageNumber} total={total} />
    </Page>
  );
}

function ClosingPage({
  p,
  slots,
  pageNumber,
  total,
}: {
  p: PropertyRecord;
  slots: BrochureSlots;
  pageNumber: number;
  total: number;
}) {
  return (
    <Page size="A4" style={s.page}>
      <Runhead p={p} label="Terms & enquiries" />
      <Text style={s.eyebrow}>§ VI — Terms &amp; Enquiries</Text>
      <Text style={[s.h1, { marginTop: 10 }]}>{slots.closingHeadline}</Text>

      <View style={{ flexDirection: "row", marginTop: 30, gap: 28 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>The terms.</Text>
          <Text style={s.bodyText}>
            Offered at {fmtKes(p.price)}, exclusive of legal fees, stamp duty and statutory charges.
            Title deeds, recent searches and survey beacons available for inspection by qualified buyers
            under a non-disclosure undertaking.
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>Process.</Text>
          {[
            "Written expression of interest & introduction",
            "NDA, brochure pack & private viewing",
            "Title search & surveyor's confirmation",
            "Offer, sale agreement & deposit",
            "Completion & transfer of titles",
          ].map((step, i) => (
            <View key={i} style={{ flexDirection: "row", marginTop: 6 }}>
              <Text style={[s.mono, { width: 56 }]}>STEP {String(i + 1).padStart(2, "0")}</Text>
              <Text style={[s.bodyText, { flex: 1 }]}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ marginTop: 30, backgroundColor: C.accent, padding: 28, color: C.paper }}>
        <View style={{ flexDirection: "row", gap: 24 }}>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: "rgba(243,239,230,0.65)" }]}>Enquiries</Text>
            <Text style={{ fontFamily: "Times-Roman", fontWeight: 300, fontSize: 26, color: C.paper, marginTop: 8 }}>
              For private viewing, please get in touch.
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.mono, { color: "rgba(243,239,230,0.55)" }]}>Sole agent</Text>
            <Text style={{ color: C.paper, fontSize: 12, marginTop: 4 }}>Sansi Africa</Text>
            <Text style={{ color: "rgba(243,239,230,0.92)", fontSize: 11 }}>Nairobi, Kenya</Text>
            <Text style={[s.mono, { color: "rgba(243,239,230,0.55)", marginTop: 10 }]}>Direct</Text>
            <Text style={{ color: C.paper, fontSize: 11 }}>+254 780 700 567</Text>
            <Text style={{ color: C.paper, fontSize: 11 }}>connect@sansi.africa</Text>
            <Text style={[s.mono, { color: "rgba(243,239,230,0.55)", marginTop: 10 }]}>Reference</Text>
            <Text style={{ color: C.paper, fontSize: 11 }}>File no. {p.referenceNumber}</Text>
          </View>
        </View>
      </View>

      <Text
        style={[s.mono, {
          marginTop: 18,
          fontSize: 7.5,
          letterSpacing: 0.6,
          lineHeight: 1.55,
          color: C.inkMute,
        }]}
      >
        THIS BROCHURE IS ISSUED FOR INFORMATION ONLY AND DOES NOT CONSTITUTE, NOR FORM PART OF, ANY
        OFFER OR CONTRACT. ALL PARTICULARS — INCLUDING AREAS, DIMENSIONS, DISTANCES AND TENURE — ARE
        GIVEN IN GOOD FAITH AND BELIEVED CORRECT, BUT ARE NOT WARRANTED; INTENDING PURCHASERS MUST
        SATISFY THEMSELVES BY INSPECTION AND INDEPENDENT ENQUIRY. PHOTOGRAPHY IS ILLUSTRATIVE.
        © {new Date().getFullYear()} SANSI PROPERTIES. ALL RIGHTS RESERVED.
      </Text>
      <Runfoot pageNumber={pageNumber} total={total} />
    </Page>
  );
}

/* --------------------------- Document --------------------------- */

export function BrochureDoc({
  p,
  slots,
  logoSrc,
}: {
  p: PropertyRecord;
  slots: BrochureSlots;
  logoSrc?: string;
}) {
  const sitePlanShown =
    p.showPlotOnBrochure !== false &&
    p.plotWidthMeters != null &&
    p.plotLengthMeters != null;
  const gallery = (p.photos?.length ?? 0) >= 3;

  const total = 4 + (sitePlanShown ? 1 : 0) + (gallery ? 1 : 0);
  let n = 1;

  return (
    <Document title={`${p.title || "Property"} — ${p.referenceNumber}`}>
      <CoverPage p={p} slots={slots} total={total} logoSrc={logoSrc} />
      <IntroPage p={p} slots={slots} pageNumber={++n} total={total} />
      <PropertyGlancePage p={p} slots={slots} pageNumber={++n} total={total} />
      {sitePlanShown ? <SitePlanPage p={p} slots={slots} pageNumber={++n} total={total} /> : null}
      <FeaturePage p={p} slots={slots} pageNumber={++n} total={total} />
      {gallery ? <GalleryPage p={p} pageNumber={++n} total={total} /> : null}
      <ClosingPage p={p} slots={slots} pageNumber={++n} total={total} />
    </Document>
  );
}
