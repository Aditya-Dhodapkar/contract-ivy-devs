// The 4-role permission system. Spec source: build brief, "Different people see
// different things." This is the single source of truth for access control —
// every server action and route guard checks against can().
//
// Deliverables: #10-#14, and enforced by #47-#51 (delete/visibility rules).

export type Role = "owner" | "assistant" | "general_manager" | "agent";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  assistant: "Assistant",
  general_manager: "General Manager",
  agent: "Agent",
};

// "all"  = applies to every property/record
// "own"  = applies only to records assigned to the acting user
// false  = not permitted at all
type Scope = "all" | "own" | false;

export interface Permissions {
  viewProperties: Scope;
  createProperty: boolean;
  editProperty: Scope;
  deleteProperty: boolean; // brief: ONLY the owner — never anyone else
  publishToWebsite: Scope; // toggle a property's public visibility
  viewDocuments: Scope;
  viewInquiries: Scope;
  viewReports: boolean;
  manageUsers: boolean;
  /** Trigger the AI-assisted brochure generator + download a PDF.
   *  Boolean (not scoped) because the action itself never mutates a record;
   *  it only reads data and renders a one-off file. Owner/Assistant/GM are
   *  authorised per client decision; Agents are not. */
  generateBrochure: boolean;
  /** Upload / replace a sensitive document (mandate, title deed, deed plan)
   *  on a property. Scoped because Agents can only touch documents on their
   *  own assigned properties. GMs are read-only — no upload. */
  uploadDocument: Scope;
  /** Delete a sensitive document. Owner-only per the brief — same rule as
   *  property deletion. Anyone else is blocked server-side. */
  deleteDocument: boolean;
}

const MATRIX: Record<Role, Permissions> = {
  owner: {
    viewProperties: "all",
    createProperty: true,
    editProperty: "all",
    deleteProperty: true,
    publishToWebsite: "all",
    viewDocuments: "all",
    viewInquiries: "all",
    viewReports: true,
    manageUsers: true,
    generateBrochure: true,
    uploadDocument: "all",
    deleteDocument: true,
  },
  assistant: {
    viewProperties: "all",
    createProperty: true,
    editProperty: "all",
    deleteProperty: false,
    // Not a role baseline — Assistants get this as a DEFAULT GRANT (see
    // DEFAULT_GRANTS) so the Owner can revoke it. Keep the role default false.
    publishToWebsite: false,
    viewDocuments: "all",
    viewInquiries: "all",
    viewReports: true,
    manageUsers: false,
    generateBrochure: true,
    uploadDocument: "all",
    deleteDocument: false,
  },
  // Read-only across data. Brochure download is the one allowed write-ish
  // action (it creates an output but mutates no records).
  general_manager: {
    viewProperties: "all",
    createProperty: false,
    editProperty: false,
    deleteProperty: false,
    publishToWebsite: false,
    viewDocuments: "all",
    viewInquiries: "all",
    viewReports: true,
    manageUsers: false,
    generateBrochure: true,
    uploadDocument: false,
    deleteDocument: false,
  },
  // Only their own assigned properties. Brochure generation deliberately
  // excluded — Owner/Assistant/GM produce client-facing output.
  agent: {
    viewProperties: "own",
    createProperty: true,
    editProperty: "own",
    deleteProperty: false,
    publishToWebsite: "own",
    viewDocuments: "own",
    viewInquiries: "own",
    viewReports: false,
    manageUsers: false,
    generateBrochure: false,
    uploadDocument: "own",
    deleteDocument: false,
  },
};

export function permissionsFor(role: Role): Permissions {
  return MATRIX[role];
}

export type Capability = keyof Permissions;

// The capabilities the Owner can hand to another user from the Team page.
// These are exactly the three things only the Owner can do by default; granting
// one flips it ON for that user regardless of their role's baseline. Per the
// client decision, even the two destructive ones are grantable (which loosens
// the original "owner-only" hard rule on property/document deletion).
export const GRANTABLE_CAPABILITIES: ReadonlyArray<{
  key: Capability;
  label: string;
  description: string;
}> = [
  {
    key: "publishToWebsite",
    label: "Publish to website",
    description:
      "Put an approved property live on the public website, and take it down again.",
  },
  {
    key: "manageUsers",
    label: "Manage team",
    description: "Add, edit and deactivate team members.",
  },
  {
    key: "deleteProperty",
    label: "Delete properties",
    description: "Permanently remove a listing. Cannot be undone.",
  },
  {
    key: "deleteDocument",
    label: "Delete documents",
    description: "Remove a mandate, title deed or deed plan from a property.",
  },
];

const GRANTABLE_KEYS = new Set<string>(GRANTABLE_CAPABILITIES.map((c) => c.key));

// Grants a user starts with, by role. These are ON by default but — unlike a
// role baseline — the Owner can revoke them from the Team page. Assistants can
// publish out of the box, yet the Owner can take it away.
export const DEFAULT_GRANTS: Partial<Record<Role, Capability[]>> = {
  assistant: ["publishToWebsite"],
};

export function defaultGrantsFor(role: Role): Capability[] {
  return [...(DEFAULT_GRANTS[role] ?? [])];
}

/** Keep only recognised, grantable capability keys — defends the DB/UI against
 *  a stray or stale key being persisted into a user's grants. */
export function sanitizeGrants(grants: unknown): Capability[] {
  if (!Array.isArray(grants)) return [];
  return grants.filter(
    (g): g is Capability => typeof g === "string" && GRANTABLE_KEYS.has(g)
  );
}

/**
 * Capability check. For scoped capabilities pass the relationship of the acting
 * user to the target record via `isOwnerOfRecord` (i.e. the agent is the
 * assigned agent on that property).
 *
 *   can("owner", "deleteProperty")                       -> true
 *   can("agent", "editProperty", { isOwnerOfRecord: true })  -> true
 *   can("agent", "editProperty", { isOwnerOfRecord: false }) -> false
 */
export function can(
  role: Role,
  capability: keyof Permissions,
  ctx: { isOwnerOfRecord?: boolean; grants?: readonly string[] } = {}
): boolean {
  // Per-user grant overrides only ever ADD a capability beyond the role's
  // baseline. Only grantable keys are ever stored, so an includes() is safe;
  // a granted capability is always full ("all") scope.
  if (ctx.grants && ctx.grants.includes(capability)) return true;
  const value = MATRIX[role][capability];
  if (typeof value === "boolean") return value;
  if (value === "all") return true;
  if (value === "own") return ctx.isOwnerOfRecord === true;
  return false;
}

export const ALL_ROLES: Role[] = ["owner", "assistant", "general_manager", "agent"];
