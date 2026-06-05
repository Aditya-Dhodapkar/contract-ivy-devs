// Pure-logic tests — no backend, no server. Run:
//   node --experimental-strip-types scripts/test-logic.ts
import assert from "node:assert/strict";
import { nextReference, isValidReference } from "../lib/referenceNumber.ts";
import { checklist } from "../lib/prepublish.ts";
import {
  CreatePropertySchema,
  UpdatePropertySchema,
} from "../lib/validation/property.ts";
import { precheckImageFile, PHOTO_MAX_BYTES } from "../lib/imageMime.ts";
import { parseCoordinatePair } from "../lib/coordinates.ts";

let pass = 0;
function t(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log("  ✓ " + name);
  } catch (e) {
    console.log("  ✗ " + name + "\n    " + (e as Error).message);
    process.exitCode = 1;
  }
}

console.log("referenceNumber");
t("first of a year is 001", () =>
  assert.equal(nextReference([], 2026), "SA-2026-001")
);
t("increments and zero-pads", () =>
  assert.equal(nextReference(["SA-2026-001", "SA-2026-002"], 2026), "SA-2026-003")
);
t("sequence restarts per year", () =>
  assert.equal(nextReference(["SA-2025-009"], 2026), "SA-2026-001")
);
t("ignores other-year + malformed entries", () =>
  assert.equal(
    nextReference(["SA-2025-099", "garbage", "SA-2026-004"], 2026),
    "SA-2026-005"
  )
);
t("no collision across 50 sequential issues", () => {
  const issued: string[] = [];
  for (let i = 0; i < 50; i++) issued.push(nextReference(issued, 2026));
  assert.equal(new Set(issued).size, 50);
  assert.equal(issued[49], "SA-2026-050");
});
t("validator accepts/rejects", () => {
  assert.ok(isValidReference("SA-2026-001"));
  assert.ok(!isValidReference("2026-001"));
});

const complete = {
  title: "Villa",
  description: "Lovely",
  price: 1000000,
  city: "Lamu",
  country: "Kenya",
  propertyType: "house" as const,
  bedrooms: 4,
  bathrooms: 3,
  plotSize: "1 acre",
  photos: ["a", "b", "c"],
  assignedAgentId: "agent-1",
};

console.log("prepublish checklist");
t("all present + mandate → ok", () =>
  assert.deepEqual(checklist(complete, true), { ok: true, missing: [] })
);
t("mandate missing is reported", () =>
  assert.ok(checklist(complete, false).missing.includes("Signed mandate document"))
);
t("fewer than 3 photos blocks", () =>
  assert.ok(
    checklist({ ...complete, photos: ["a", "b"] }, true).missing.includes(
      "At least 3 photos"
    )
  )
);
t("no assigned agent blocks", () =>
  assert.ok(
    checklist({ ...complete, assignedAgentId: undefined }, true).missing.includes(
      "Assigned agent"
    )
  )
);
t("beds/baths required only for houses", () => {
  const land = { ...complete, propertyType: "land" as const, bedrooms: undefined, bathrooms: undefined };
  assert.equal(checklist(land, true).ok, true);
  const house = { ...complete, bedrooms: undefined };
  assert.ok(checklist(house, true).missing.includes("Bedrooms"));
});
t("each core field individually blocks", () => {
  for (const k of ["title", "description", "city", "plotSize"] as const) {
    const r = checklist({ ...complete, [k]: undefined }, true);
    assert.equal(r.ok, false, k + " should block");
  }
  assert.equal(checklist({ ...complete, price: 0 }, true).ok, false);
});

console.log("property create schema (strict required set)");
const ok = (input: unknown) => CreatePropertySchema.safeParse(input).success;
const fieldOf = (input: unknown) => {
  const r = CreatePropertySchema.safeParse(input);
  return r.success ? null : (r.error.issues[0]?.path[0] ?? null);
};
// A complete, valid create payload: every required field present. Individual
// cases tweak ONE field so the failing issue is unambiguous. assignedAgentId is
// intentionally absent — it's enforced in the route, not the schema (agents are
// force-assigned), so the schema must accept its absence.
const validCreate = {
  title: "Seaside villa",
  country: "Kenya",
  city: "Lamu",
  propertyType: "house" as const,
  price: 50_000_000,
  bedrooms: 4,
  bathrooms: 3,
  yearBuilt: 1998,
  plotSize: "1 acre",
  builtArea: "3,200 sqft",
  facingDirection: "E" as const,
  plotWidthMeters: 40,
  plotLengthMeters: 80,
  description: "A lovely home by the sea.",
  highlights: ["Beachfront"],
  amenities: ["Pool"],
  nearby: [{ place: "Lamu Airport", distance: "10 min", description: "Airstrip" }],
  photos: ["https://example.com/img1.jpg"],
  latitude: -2.27,
  longitude: 40.9,
  tenure: "freehold" as const,
  shape: "Rectangular",
  siteCondition: "Vacant",
  saleTerms: "Single transaction",
  topography: "Gently sloping",
  boundary: "Mature hedge",
  services: "Mains water",
};
const without = (k: string) => ({ ...validCreate, [k]: undefined });

t("a complete payload passes", () => assert.ok(ok(validCreate)));
t("title-only now fails (the whole set is required, not just title)", () =>
  assert.equal(ok({ title: "Seaside villa" }), false)
);
t("empty payload fails on title (first field)", () => {
  assert.equal(ok({}), false);
  assert.equal(fieldOf({}), "title");
});
t("blank/whitespace title fails", () =>
  assert.equal(ok({ ...validCreate, title: "   " }), false)
);
t("every required field individually blocks (missing → its own issue)", () => {
  const required = [
    "title", "country", "city", "propertyType", "price", "bedrooms",
    "bathrooms", "yearBuilt", "plotSize", "builtArea", "facingDirection",
    "plotWidthMeters", "plotLengthMeters", "description", "highlights",
    "amenities", "nearby", "photos", "latitude", "longitude", "tenure",
    "shape", "siteCondition", "saleTerms", "topography", "boundary", "services",
  ] as const;
  for (const k of required) {
    assert.equal(ok(without(k)), false, `${k} should be required`);
    assert.equal(fieldOf(without(k)), k, `missing ${k} should report ${k}`);
  }
});
t("the two '(optional)' fields stay optional", () => {
  assert.ok(ok({ ...validCreate, yearRestored: undefined, restorationNotes: undefined }));
});
t("assignedAgentId is NOT required by the schema (route enforces it)", () =>
  assert.ok(ok({ ...validCreate, assignedAgentId: undefined }))
);
t("empty arrays fail their own field", () => {
  for (const k of ["highlights", "amenities", "nearby", "photos"] as const) {
    assert.equal(ok({ ...validCreate, [k]: [] }), false, `${k}: [] should fail`);
    assert.equal(fieldOf({ ...validCreate, [k]: [] }), k);
  }
});
t("negative/non-integer bedrooms fail on bedrooms", () => {
  assert.equal(fieldOf({ ...validCreate, bedrooms: -1 }), "bedrooms");
  assert.equal(ok({ ...validCreate, bedrooms: 2.5 }), false);
});
t("0 bedrooms is allowed (e.g. land/studio)", () =>
  assert.ok(ok({ ...validCreate, bedrooms: 0, bathrooms: 0 }))
);
t("price must be positive (0 fails)", () => {
  assert.equal(ok({ ...validCreate, price: 0 }), false);
  assert.equal(fieldOf({ ...validCreate, price: -100 }), "price");
});
t("plot width must be > 0", () =>
  assert.equal(ok({ ...validCreate, plotWidthMeters: 0 }), false)
);
t("lat=999 fails on latitude", () => {
  assert.equal(fieldOf({ ...validCreate, latitude: 999 }), "latitude");
});
t("lat=-1.2 passes", () => assert.ok(ok({ ...validCreate, latitude: -1.2 })));
t("absurd / future year fails", () => {
  assert.equal(ok({ ...validCreate, yearBuilt: 1500 }), false);
  assert.equal(ok({ ...validCreate, yearBuilt: new Date().getFullYear() + 5 }), false);
});
t("immutable fields are stripped, not stored", () => {
  const r = CreatePropertySchema.safeParse({
    ...validCreate,
    referenceNumber: "SA-2026-001",
    approval: "approved",
    id: "prop-hack",
    status: "active",
  });
  assert.ok(r.success);
  assert.ok(!("referenceNumber" in r.data));
  assert.ok(!("approval" in r.data));
  assert.ok(!("id" in r.data));
  assert.ok(!("status" in r.data));
});
t("nullable photo dimensions accepted (unknown dims)", () =>
  assert.ok(ok({ ...validCreate, photoDimensions: [null] }))
);

console.log("property update schema (lenient)");
const okU = (input: unknown) => UpdatePropertySchema.safeParse(input).success;
t("a single-field update passes (no required set)", () =>
  assert.ok(okU({ city: "Nairobi" }))
);
t("an empty update passes (PATCH may set nothing)", () => assert.ok(okU({})));
t("update still range-checks a present field", () =>
  assert.equal(okU({ latitude: 999 }), false)
);
t("update allows a blank-everything-but-one edit", () =>
  assert.ok(okU({ title: "Renamed only" }))
);

console.log("image pre-check (L6)");
t("normal JPG passes", () =>
  assert.equal(precheckImageFile({ name: "a.jpg", size: 1000, type: "image/jpeg" }), null)
);
t("oversize file is rejected", () =>
  assert.ok(precheckImageFile({ name: "big.jpg", size: PHOTO_MAX_BYTES + 1, type: "image/jpeg" }))
);
t("explicit non-image MIME is rejected", () =>
  assert.ok(precheckImageFile({ name: "doc.pdf", size: 1000, type: "application/pdf" }))
);
t("HEIC with explicit MIME passes", () =>
  assert.equal(precheckImageFile({ name: "IMG_0001.HEIC", size: 1000, type: "image/heic" }), null)
);
t("HEIC with empty MIME passes via extension (iPhone case)", () =>
  assert.equal(precheckImageFile({ name: "IMG_0001.HEIC", size: 1000, type: "" }), null)
);
t("empty MIME + non-image extension is rejected", () =>
  assert.ok(precheckImageFile({ name: "notes.txt", size: 1000, type: "" }))
);
t("octet-stream + image extension passes", () =>
  assert.equal(
    precheckImageFile({ name: "photo.png", size: 1000, type: "application/octet-stream" }),
    null
  )
);

console.log("coordinate paste parser (M2)");
t("comma+space pair parses", () =>
  assert.deepEqual(parseCoordinatePair("-1.2163, 36.7928"), {
    lat: -1.2163,
    lng: 36.7928,
  })
);
t("comma-only (no space) pair parses", () =>
  assert.deepEqual(parseCoordinatePair("-1.2163,36.7928"), {
    lat: -1.2163,
    lng: 36.7928,
  })
);
t("whitespace-separated pair parses", () =>
  assert.deepEqual(parseCoordinatePair("-1.2163   36.7928"), {
    lat: -1.2163,
    lng: 36.7928,
  })
);
t("surrounding whitespace is trimmed", () =>
  assert.deepEqual(parseCoordinatePair("  1.5, 2.5  "), { lat: 1.5, lng: 2.5 })
);
t("single number is not a pair (null → normal paste)", () =>
  assert.equal(parseCoordinatePair("-1.2163"), null)
);
t("three values is not a pair (null)", () =>
  assert.equal(parseCoordinatePair("1, 2, 3"), null)
);
t("non-numeric pair is not a pair (null)", () =>
  assert.equal(parseCoordinatePair("Lamu, Kenya"), null)
);
t("empty string is null", () => assert.equal(parseCoordinatePair("   "), null));
t("out-of-range latitude returns an error", () => {
  const r = parseCoordinatePair("999, 36.7928");
  assert.ok(r && "error" in r);
});
t("out-of-range longitude returns an error", () => {
  const r = parseCoordinatePair("1.5, 200");
  assert.ok(r && "error" in r);
});
t("boundary values (-90, 180) are accepted", () =>
  assert.deepEqual(parseCoordinatePair("-90, 180"), { lat: -90, lng: 180 })
);

console.log(`\n${pass} checks passed`);
