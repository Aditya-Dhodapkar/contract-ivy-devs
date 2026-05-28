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
    publishToWebsite: "all",
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
  ctx: { isOwnerOfRecord?: boolean } = {}
): boolean {
  const value = MATRIX[role][capability];
  if (typeof value === "boolean") return value;
  if (value === "all") return true;
  if (value === "own") return ctx.isOwnerOfRecord === true;
  return false;
}

export const ALL_ROLES: Role[] = ["owner", "assistant", "general_manager", "agent"];
