// Pure-logic tests — no backend, no server. Run:
//   node --experimental-strip-types scripts/test-logic.ts
import assert from "node:assert/strict";
import { nextReference, isValidReference } from "../lib/referenceNumber.ts";
import { checklist } from "../lib/prepublish.ts";

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

console.log(`\n${pass} checks passed`);
