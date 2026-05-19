// Data-access layer for properties. Mirrors the lib/devUsers.ts fallback:
// a file-backed JSON backend for dev/testing now, a Sanity backend for
// production later. Swapping is an env change, not a logic rewrite.
//
// Business rules (reference numbers, checklist, RBAC scoping) live OUTSIDE
// this file so they're testable without any backend.

import { promises as fs } from "fs";
import path from "path";
import { sanity } from "@/lib/sanity";
import { usingDevUsers } from "@/lib/devUsers";
import { nextReference } from "@/lib/referenceNumber";
import type { Role } from "@/lib/roles";

export type PropertyStatus = "draft" | "active" | "sold" | "rented";
export type PropertyType = "house" | "apartment" | "land" | "commercial";

export interface PropertyRecord {
  id: string;
  referenceNumber: string; // immutable once set
  title?: string;
  region?: string;
  propertyType?: PropertyType;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  plotSize?: string;
  description?: string;
  photos?: string[];
  floorPlan?: string;
  assignedAgentId?: string;
  sellerId?: string;
  status: PropertyStatus;
  showOnWebsite: boolean;
  isPrivate: boolean;
  accessCode?: string;
  createdAt: string;
}

export interface ListScope {
  role: Role;
  userId: string;
}

// Agents only ever see their own assigned properties (#51). Everyone else
// sees all. Deletion never happens here for non-owners — enforced upstream
// in the server action, and there is simply no hard-delete in the dev store
// beyond the owner path.
function visibleTo(scope: ListScope, p: PropertyRecord): boolean {
  if (scope.role === "agent") return p.assignedAgentId === scope.userId;
  return true;
}

/* ----------------------------- dev backend ----------------------------- */

const DEV_FILE = path.join(process.cwd(), ".devdata", "properties.json");

async function devReadAll(): Promise<PropertyRecord[]> {
  try {
    return JSON.parse(await fs.readFile(DEV_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function devWriteAll(rows: PropertyRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(rows, null, 2));
}

/* --------------------------- public repo API --------------------------- */

export async function listProperties(scope: ListScope): Promise<PropertyRecord[]> {
  if (usingDevUsers) {
    const all = await devReadAll();
    return all.filter((p) => visibleTo(scope, p));
  }
  const all: PropertyRecord[] = await sanity.fetch(
    `*[_type == "property"]{ "id": _id, ..., "assignedAgentId": assignedAgent->_id }`
  );
  return all.filter((p) => visibleTo(scope, p));
}

export async function getProperty(id: string): Promise<PropertyRecord | null> {
  if (usingDevUsers) {
    return (await devReadAll()).find((p) => p.id === id) ?? null;
  }
  return sanity.fetch(
    `*[_type == "property" && _id == $id][0]{ "id": _id, ..., "assignedAgentId": assignedAgent->_id }`,
    { id }
  );
}

export async function createProperty(
  data: Partial<PropertyRecord>
): Promise<PropertyRecord> {
  const year = new Date().getFullYear();
  if (usingDevUsers) {
    const all = await devReadAll();
    const record: PropertyRecord = {
      id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      referenceNumber: nextReference(all.map((p) => p.referenceNumber), year),
      status: "draft",
      showOnWebsite: false,
      isPrivate: false,
      createdAt: new Date().toISOString(),
      ...data,
    };
    await devWriteAll([...all, record]);
    return record;
  }
  const existing: string[] = await sanity.fetch(
    `*[_type == "property"].referenceNumber`
  );
  const reference = nextReference(existing, year);
  const created = await sanity.create({
    _type: "property",
    referenceNumber: reference,
    status: "draft",
    showOnWebsite: false,
    isPrivate: false,
    ...data,
  });
  return { ...(created as any), id: created._id };
}

// referenceNumber is intentionally never patched — it is immutable (#22).
export async function updateProperty(
  id: string,
  patch: Partial<PropertyRecord>
): Promise<PropertyRecord> {
  const { referenceNumber: _drop, id: _id, ...safe } = patch;
  if (usingDevUsers) {
    const all = await devReadAll();
    const i = all.findIndex((p) => p.id === id);
    if (i === -1) throw new Error("not found");
    all[i] = { ...all[i], ...safe };
    await devWriteAll(all);
    return all[i];
  }
  const updated = await sanity.patch(id).set(safe).commit();
  return { ...(updated as any), id: updated._id };
}

// Hard delete. Caller MUST gate this to the Owner (brief non-negotiable #1).
export async function deleteProperty(id: string): Promise<void> {
  if (usingDevUsers) {
    const all = await devReadAll();
    await devWriteAll(all.filter((p) => p.id !== id));
    return;
  }
  await sanity.delete(id);
}
