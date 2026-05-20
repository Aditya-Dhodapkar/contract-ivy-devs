// Data-access layer for properties. Two interchangeable backends:
//   - dev:  JSON file at .devdata/properties.json   (USE_DEV_DATA=true)
//   - prod: Supabase Postgres                       (USE_DEV_DATA=false)
//
// Business rules (reference numbers, checklist, RBAC scoping) live OUTSIDE
// this file so they're testable without any backend.

import { promises as fs } from "fs";
import path from "path";
import { usingDevData } from "@/lib/devUsers";
import { supabase } from "@/lib/supabase";
import { nextReference } from "@/lib/referenceNumber";
import type { Role } from "@/lib/roles";

export type PropertyStatus = "draft" | "active" | "sold" | "rented";
export type PropertyType = "house" | "apartment" | "land" | "commercial";
export type PropertyApproval = "pending" | "approved" | "changes_requested";

export interface PropertyRecord {
  id: string;
  referenceNumber: string; // immutable once set
  title?: string;
  country?: string;
  city?: string;
  propertyType?: PropertyType;
  price?: number; // KES
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  yearRestored?: number;
  plotSize?: string;
  builtArea?: string;
  description?: string;
  highlights?: string[];
  amenities?: string[];
  nearby?: { place: string; distance: string }[];
  photos?: string[];
  floorPlan?: string;
  assignedAgentId?: string;
  sellerId?: string;
  status: PropertyStatus;
  showOnWebsite: boolean;
  isPrivate: boolean;
  accessCode?: string;
  createdAt: string;
  idempotencyKey?: string;
  approval: PropertyApproval;
  changesRequestedNote?: string;
}

export interface ListScope {
  role: Role;
  userId: string;
}

// Agents see only their own assigned properties (#51). Everyone else sees all.
function visibleTo(scope: ListScope, p: PropertyRecord): boolean {
  if (scope.role === "agent") return p.assignedAgentId === scope.userId;
  return true;
}

/* ------------------- row ↔ record mapping (prod only) ------------------- */

type Row = Record<string, unknown>;

function toRow(rec: Partial<PropertyRecord>): Row {
  // Map every camelCase field to its snake_case column. Undefined fields are
  // stripped before .insert/.update so they don't blank existing values.
  const row: Row = {
    id: rec.id,
    reference_number: rec.referenceNumber,
    title: rec.title,
    country: rec.country,
    city: rec.city,
    property_type: rec.propertyType,
    price: rec.price,
    bedrooms: rec.bedrooms,
    bathrooms: rec.bathrooms,
    year_built: rec.yearBuilt,
    year_restored: rec.yearRestored,
    plot_size: rec.plotSize,
    built_area: rec.builtArea,
    description: rec.description,
    highlights: rec.highlights,
    amenities: rec.amenities,
    nearby: rec.nearby,
    photos: rec.photos,
    floor_plan: rec.floorPlan,
    assigned_agent_id: rec.assignedAgentId,
    seller_id: rec.sellerId,
    status: rec.status,
    show_on_website: rec.showOnWebsite,
    is_private: rec.isPrivate,
    access_code: rec.accessCode,
    approval: rec.approval,
    changes_requested_note: rec.changesRequestedNote,
    idempotency_key: rec.idempotencyKey,
    created_at: rec.createdAt,
  };
  return compact(row);
}

function fromRow(r: Row): PropertyRecord {
  return {
    id: r.id as string,
    referenceNumber: r.reference_number as string,
    title: (r.title as string) ?? undefined,
    country: (r.country as string) ?? undefined,
    city: (r.city as string) ?? undefined,
    propertyType: (r.property_type as PropertyType) ?? undefined,
    price: r.price == null ? undefined : Number(r.price),
    bedrooms: (r.bedrooms as number) ?? undefined,
    bathrooms: (r.bathrooms as number) ?? undefined,
    yearBuilt: (r.year_built as number) ?? undefined,
    yearRestored: (r.year_restored as number) ?? undefined,
    plotSize: (r.plot_size as string) ?? undefined,
    builtArea: (r.built_area as string) ?? undefined,
    description: (r.description as string) ?? undefined,
    highlights: (r.highlights as string[]) ?? undefined,
    amenities: (r.amenities as string[]) ?? undefined,
    nearby: (r.nearby as PropertyRecord["nearby"]) ?? undefined,
    photos: (r.photos as string[]) ?? undefined,
    floorPlan: (r.floor_plan as string) ?? undefined,
    assignedAgentId: (r.assigned_agent_id as string) ?? undefined,
    sellerId: (r.seller_id as string) ?? undefined,
    status: r.status as PropertyStatus,
    showOnWebsite: !!r.show_on_website,
    isPrivate: !!r.is_private,
    accessCode: (r.access_code as string) ?? undefined,
    createdAt: r.created_at as string,
    idempotencyKey: (r.idempotency_key as string) ?? undefined,
    approval: r.approval as PropertyApproval,
    changesRequestedNote: (r.changes_requested_note as string) ?? undefined,
  };
}

function compact<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
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

// Dev mutex: in-process lock so two concurrent POSTs can't race the file.
// Production uses Postgres unique indexes instead (see createProperty).
let createMutex: Promise<unknown> = Promise.resolve();
function withCreateLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = createMutex.then(fn, fn);
  createMutex = next.catch(() => undefined);
  return next;
}

/* --------------------------- public repo API --------------------------- */

export async function listProperties(scope: ListScope): Promise<PropertyRecord[]> {
  if (usingDevData) {
    const all = await devReadAll();
    return all.filter((p) => visibleTo(scope, p));
  }
  let q = supabase().from("properties").select("*").order("created_at", { ascending: false });
  if (scope.role === "agent") q = q.eq("assigned_agent_id", scope.userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

export async function getProperty(id: string): Promise<PropertyRecord | null> {
  if (usingDevData) {
    return (await devReadAll()).find((p) => p.id === id) ?? null;
  }
  const { data, error } = await supabase()
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data) : null;
}

export async function createProperty(
  data: Partial<PropertyRecord>,
  creatorRole?: Role
): Promise<PropertyRecord> {
  const year = new Date().getFullYear();
  // Owner-created → pre-approved; everyone else → pending.
  const initialApproval: PropertyApproval =
    creatorRole === "owner" ? "approved" : "pending";
  const newId = `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (usingDevData) {
    return withCreateLock(async () => {
      const all = await devReadAll();
      if (data.idempotencyKey) {
        const prior = all.find((p) => p.idempotencyKey === data.idempotencyKey);
        if (prior) return prior;
      }
      const record: PropertyRecord = {
        id: newId,
        referenceNumber: nextReference(all.map((p) => p.referenceNumber), year),
        status: "draft",
        showOnWebsite: false,
        isPrivate: false,
        createdAt: new Date().toISOString(),
        ...data,
        approval: initialApproval,
      };
      await devWriteAll([...all, record]);
      return record;
    });
  }

  // --- Supabase production path ---
  const sb = supabase();
  // 1. Idempotency: if a record with this key already exists, return it as-is.
  if (data.idempotencyKey) {
    const { data: prior } = await sb
      .from("properties")
      .select("*")
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle();
    if (prior) return fromRow(prior);
  }
  // 2. Allocate a reference number, then insert. The UNIQUE index on
  //    reference_number catches concurrent collisions; we retry with a
  //    bumped sequence in that case.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await sb
      .from("properties")
      .select("reference_number")
      .like("reference_number", `SA-${year}-%`);
    const refs = (existing ?? []).map((r: { reference_number: string }) => r.reference_number);
    const reference = nextReference(refs, year);
    const row = toRow({
      id: newId,
      status: "draft",
      showOnWebsite: false,
      isPrivate: false,
      createdAt: new Date().toISOString(),
      ...data,
      referenceNumber: reference,
      approval: initialApproval,
    });
    const { data: inserted, error } = await sb
      .from("properties")
      .insert(row)
      .select()
      .single();
    if (!error && inserted) return fromRow(inserted);
    // Idempotency-key race lost — another request beat us; return that record.
    if (error?.code === "23505" && /idempotency/i.test(error.message)) {
      const { data: prior } = await sb
        .from("properties")
        .select("*")
        .eq("idempotency_key", data.idempotencyKey!)
        .maybeSingle();
      if (prior) return fromRow(prior);
    }
    // Reference-number collision — bump and retry.
    if (error?.code === "23505" && /reference_number/i.test(error.message)) continue;
    throw new Error(error?.message ?? "Insert failed");
  }
  throw new Error("Could not allocate a unique reference number after 5 attempts");
}

// referenceNumber is immutable (#22). approval is set via dedicated endpoints
// (approve / request-changes) and stripped from generic PATCH bodies here.
export async function updateProperty(
  id: string,
  patch: Partial<PropertyRecord>,
  editorRole?: Role
): Promise<PropertyRecord> {
  const {
    referenceNumber: _drop,
    id: _id,
    approval: _ignoreApproval,
    changesRequestedNote: _ignoreNote,
    ...safe
  } = patch;
  const nonOwnerEdit = editorRole !== undefined && editorRole !== "owner";

  if (usingDevData) {
    const all = await devReadAll();
    const i = all.findIndex((p) => p.id === id);
    if (i === -1) throw new Error("not found");
    const next = { ...all[i], ...safe };
    if (nonOwnerEdit) {
      next.approval = "pending";
      next.changesRequestedNote = undefined;
    }
    all[i] = next;
    await devWriteAll(all);
    return next;
  }

  const sb = supabase();
  const update = toRow(safe);
  if (nonOwnerEdit) {
    update.approval = "pending";
    update.changes_requested_note = null; // explicit null clears the column
  }
  const { data, error } = await sb
    .from("properties")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function countPropertiesAssignedTo(userId: string): Promise<number> {
  if (usingDevData) {
    return (await devReadAll()).filter((p) => p.assignedAgentId === userId).length;
  }
  const { count, error } = await supabase()
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("assigned_agent_id", userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countPendingApprovals(): Promise<number> {
  if (usingDevData) {
    return (await devReadAll()).filter((p) => p.approval === "pending").length;
  }
  const { count, error } = await supabase()
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("approval", "pending");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Owner action — set approval explicitly. */
export async function setApproval(
  id: string,
  approval: PropertyApproval,
  note?: string
): Promise<PropertyRecord> {
  if (usingDevData) {
    const all = await devReadAll();
    const i = all.findIndex((p) => p.id === id);
    if (i === -1) throw new Error("not found");
    all[i] = {
      ...all[i],
      approval,
      changesRequestedNote: approval === "changes_requested" ? note : undefined,
    };
    await devWriteAll(all);
    return all[i];
  }
  const sb = supabase();
  const { data, error } = await sb
    .from("properties")
    .update({
      approval,
      changes_requested_note: approval === "changes_requested" ? (note ?? "") : null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data);
}

// Hard delete. Caller MUST gate to the Owner (brief non-negotiable #1).
export async function deleteProperty(id: string): Promise<void> {
  if (usingDevData) {
    const all = await devReadAll();
    await devWriteAll(all.filter((p) => p.id !== id));
    return;
  }
  const { error } = await supabase().from("properties").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
