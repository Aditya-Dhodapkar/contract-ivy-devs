// Shared zod schemas for the add/edit-property payload (Phase 1 — see
// error_handling.md §1.2; required-set expanded in the Phase 3 follow-up). This
// is the single source of truth for shape + range validation on both create and
// update routes; the form (components/PropertyForm.tsx) reuses the same schemas
// client-side for instant inline errors.
//
// Two schemas, deliberately asymmetric:
//  - CREATE is strict: every field is REQUIRED except the two the UI marks
//    "(optional)" — yearRestored and restorationNotes — plus the genuinely
//    optional extras (floor plan, captions/dimensions, brochure toggles, and
//    assignedAgentId which is enforced separately because agents are
//    force-assigned server-side). This is the product decision to stop
//    half-filled listings being created (the publish-time gate in
//    lib/prepublish.ts still applies on top).
//  - UPDATE is lenient: every field optional (a PATCH may touch just one), so
//    editing an existing property is never blocked by an unrelated blank. Same
//    range/type rules apply when a field IS present.
//
// Design notes:
//  - Field keys match the form input `name`s and PropertyRecord camelCase, so a
//    zod issue on e.g. `latitude` maps straight to that input (error envelope §4A).
//  - Immutable/server-owned fields (referenceNumber, approval, id, status,
//    createdAt) are intentionally NOT in either schema, so zod's default object
//    behaviour strips them — keeping parity with lib/repo/properties.ts.
//  - Messages are plain language for a non-technical back-office user (§4D).

import { z } from "zod";

// Sane year window for built/restored. currentYear is read once at module load.
const currentYear = new Date().getFullYear();

const PROPERTY_TYPES = ["house", "apartment", "land", "commercial"] as const;
const TENURES = ["freehold", "leasehold"] as const;
const FACING = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

// Upper bound on price (KES). Generous — guards against a fat-fingered/pasted
// absurd number, not a real listing.
const MAX_PRICE = 1_000_000_000_000; // 1 trillion KES

// Optional year field (only validated if present) — used for yearRestored and,
// in the update schema, every year.
const optionalYear = z
  .number()
  .int("Enter the year as a whole number.")
  .min(1800, "That year looks too early — check it.")
  .max(currentYear + 1, "That year can't be in the future.")
  .optional();

const nearbyItem = z.object({
  place: z.string(),
  distance: z.string(),
  description: z.string().optional(),
});

// Pixel dimensions captured at upload. The form stores `null` for photos whose
// dimensions are unknown, so the array may contain nulls — accept them.
const photoDimension = z.object({ w: z.number(), h: z.number() }).nullable();

// ─── Lenient field set (used by UPDATE; everything optional) ────────────────
// Every field is "validate only if present" here. Range/type rules still bite
// when a value is supplied.
const baseFields = {
  title: z.string().trim().min(1, "Add a title before saving.").max(200, "That title is too long.").optional(),
  country: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  propertyType: z.enum(PROPERTY_TYPES, { message: "Choose a valid property type." }).optional(),
  price: z
    .number({ message: "Price must be a number." })
    .min(0, "Price can't be negative.")
    .max(MAX_PRICE, "That price looks too high — check the amount.")
    .optional(),
  bedrooms: z
    .number({ message: "Bedrooms must be a number." })
    .int("Bedrooms must be a whole number.")
    .min(0, "Bedrooms can't be negative.")
    .max(1000, "That's more bedrooms than expected — check the number.")
    .optional(),
  bathrooms: z
    .number({ message: "Bathrooms must be a number." })
    .int("Bathrooms must be a whole number.")
    .min(0, "Bathrooms can't be negative.")
    .max(1000, "That's more bathrooms than expected — check the number.")
    .optional(),
  yearBuilt: optionalYear,
  yearRestored: optionalYear,
  restorationNotes: z.string().optional(),
  plotSize: z.string().optional(),
  builtArea: z.string().optional(),
  facingDirection: z.enum(FACING, { message: "Choose a valid facing direction." }).optional(),
  plotWidthMeters: z
    .number({ message: "Plot width must be a number." })
    .min(0, "Plot width can't be negative.")
    .max(100_000, "That plot width looks too large — check it.")
    .optional(),
  plotLengthMeters: z
    .number({ message: "Plot length must be a number." })
    .min(0, "Plot length can't be negative.")
    .max(100_000, "That plot length looks too large — check it.")
    .optional(),
  description: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  nearby: z.array(nearbyItem).optional(),
  photos: z.array(z.string()).optional(),
  photoCaptions: z.array(z.string()).optional(),
  photoDimensions: z.array(photoDimension).optional(),
  floorPlan: z.string().optional(),
  floorPlans: z.array(z.string()).optional(),
  tenure: z.enum(TENURES, { message: "Choose a valid tenure." }).optional(),
  shape: z.string().optional(),
  siteCondition: z.string().optional(),
  saleTerms: z.string().optional(),
  latitude: z
    .number({ message: "Latitude must be a number." })
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90.")
    .optional(),
  longitude: z
    .number({ message: "Longitude must be a number." })
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180.")
    .optional(),
  topography: z.string().optional(),
  boundary: z.string().optional(),
  services: z.string().optional(),
  assignedAgentId: z.string().optional(),
  sellerId: z.string().optional(),
  accessCode: z.string().optional(),
  showOnWebsite: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  showMapOnBrochure: z.boolean().optional(),
  showPlotOnBrochure: z.boolean().optional(),
  // Client-supplied double-submit guard — legitimately passed on create.
  idempotencyKey: z.string().optional(),
};

// Friendly message for a non-object/malformed body (e.g. a broken client
// sending null or a bare string) — the per-field issues handle the normal
// "valid object, bad value" cases.
const bodyParams = { message: "Please fill in the property form before saving." };

// ─── Strict required overrides (used by CREATE) ─────────────────────────────
// Required = the field must be present (and pass its range). The `message` on a
// number/enum covers the missing/undefined case (zod's invalid_type); `.min(1)`
// on a string covers present-but-blank; `.min(1)` on an array covers "[]".
const requiredString = (message: string, max?: number) => {
  let s = z.string({ message }).trim().min(1, message);
  if (max) s = s.max(max, "That value is too long.");
  return s;
};

const createRequired = {
  title: requiredString("Add a title before saving.", 200),
  country: requiredString("Add the country."),
  city: requiredString("Add the city or town."),
  propertyType: z.enum(PROPERTY_TYPES, { message: "Choose the property type." }),
  price: z
    .number({ message: "Add the asking price." })
    .positive("Add the asking price.")
    .max(MAX_PRICE, "That price looks too high — check the amount."),
  bedrooms: z
    .number({ message: "Add the number of bedrooms (0 if none)." })
    .int("Bedrooms must be a whole number.")
    .min(0, "Bedrooms can't be negative.")
    .max(1000, "That's more bedrooms than expected — check the number."),
  bathrooms: z
    .number({ message: "Add the number of bathrooms (0 if none)." })
    .int("Bathrooms must be a whole number.")
    .min(0, "Bathrooms can't be negative.")
    .max(1000, "That's more bathrooms than expected — check the number."),
  yearBuilt: z
    .number({ message: "Add the year built." })
    .int("Enter the year as a whole number.")
    .min(1800, "That year looks too early — check it.")
    .max(currentYear + 1, "That year can't be in the future."),
  plotSize: requiredString("Add the plot size."),
  builtArea: requiredString("Add the built area."),
  facingDirection: z.enum(FACING, { message: "Choose the facing direction." }),
  plotWidthMeters: z
    .number({ message: "Add the plot width in metres." })
    .positive("Plot width must be greater than 0.")
    .max(100_000, "That plot width looks too large — check it."),
  plotLengthMeters: z
    .number({ message: "Add the plot length in metres." })
    .positive("Plot length must be greater than 0.")
    .max(100_000, "That plot length looks too large — check it."),
  description: requiredString("Add a description."),
  // The `message` param covers a missing array (zod's bare "Required"); `.min(1)`
  // covers a present-but-empty `[]` (the case the form actually sends).
  highlights: z
    .array(z.string(), { message: "Add at least one highlight." })
    .min(1, "Add at least one highlight."),
  amenities: z
    .array(z.string(), { message: "Add at least one amenity." })
    .min(1, "Add at least one amenity."),
  nearby: z
    .array(nearbyItem, { message: "Add at least one nearby place." })
    .min(1, "Add at least one nearby place."),
  photos: z
    .array(z.string(), { message: "Add at least one photo." })
    .min(1, "Add at least one photo."),
  latitude: z
    .number({ message: "Add the latitude." })
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90."),
  longitude: z
    .number({ message: "Add the longitude." })
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180."),
  tenure: z.enum(TENURES, { message: "Choose the tenure." }),
  shape: requiredString("Add the plot shape."),
  siteCondition: requiredString("Add the site condition."),
  saleTerms: requiredString("Add the sale terms."),
  topography: requiredString("Add the topography."),
  boundary: requiredString("Add the boundary."),
  services: requiredString("Add the services."),
  // NOTE: assignedAgentId stays OPTIONAL even on create — agents are
  // force-assigned to themselves server-side and never send it. The "an agent
  // must be assigned" rule is enforced for non-agent creators in the create
  // route + the form (it knows the user's role); it can't live in the shared
  // schema without breaking agent creates. Likewise yearRestored,
  // restorationNotes, and the floor plan are the UI's "(optional)" fields and
  // stay optional here.
};

/** Create payload: strict required set (see createRequired). Unknown keys
 *  (referenceNumber, approval, id, status, …) are stripped by zod's default. */
export const CreatePropertySchema = z.object(
  { ...baseFields, ...createRequired },
  bodyParams
);

/** Update payload: every field optional (a PATCH may touch just one). Same
 *  range/type rules apply when a field is present. */
export const UpdatePropertySchema = z.object(baseFields, bodyParams);

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;
