// Team member repository. Mirrors lib/repo/properties.ts:
//   - dev backend: file-backed JSON at .devdata/users.json (when
//     USE_DEV_USERS=true). The seeded dev logins from lib/devUsers.ts remain
//     available for login as well, so the 4 test logins always work.
//   - production: Sanity `user` documents.
//
// Hard rules (#6-#9):
//   - Soft deactivate only — we never hard-delete users (history protection,
//     same principle as properties).
//   - Passwords are bcrypt hashed; plaintext never persisted.
//   - Email uniqueness enforced at create. Concurrency-safe via a mutex.

import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { sanity } from "@/lib/sanity";
import { usingDevUsers, DEV_USERS } from "@/lib/devUsers";
import type { Role } from "@/lib/roles";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedRegions?: string[];
  personalAssistantId?: string;
  active: boolean;
  passwordHash: string;
  createdAt: string;
  /** True after an admin reset until the user picks their own password. */
  mustChangePassword?: boolean;
  /** Last successful sign-in (ISO). null/undefined if never signed in. */
  lastLoginAt?: string;
  /** Marks the 4 dev seed users (display only — they're editable too). */
  seed?: boolean;
}

const DEV_FILE = path.join(process.cwd(), ".devdata", "users.json");

async function devReadAll(): Promise<UserRecord[]> {
  try {
    return JSON.parse(await fs.readFile(DEV_FILE, "utf8"));
  } catch {
    return [];
  }
}
async function devWriteAll(rows: UserRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(rows, null, 2));
}

/** Seeds expressed as full UserRecords (active, seed=true). */
function devSeedRecords(): UserRecord[] {
  return DEV_USERS.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    passwordHash: u.passwordHash,
    active: true,
    createdAt: "1970-01-01T00:00:00.000Z",
    seed: true,
  }));
}

let createMutex: Promise<unknown> = Promise.resolve();
function withCreateLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = createMutex.then(fn, fn);
  createMutex = next.catch(() => undefined);
  return next;
}

/* --------------------------- public API --------------------------- */

/** Combined list. In dev: seed defaults + custom users, where a custom record
 *  with the same id as a seed *overrides* the seed (so edits/deactivations
 *  shadow the default). In production: straight from Sanity. */
export async function listUsers(): Promise<UserRecord[]> {
  if (usingDevUsers) {
    const disk = await devReadAll();
    const diskIds = new Set(disk.map((u) => u.id));
    const seeds = devSeedRecords().filter((s) => !diskIds.has(s.id));
    return [...seeds, ...disk];
  }
  const rows: UserRecord[] = await sanity.fetch(
    `*[_type == "user"]{ "id": _id, name, email, role, assignedRegions, "personalAssistantId": personalAssistant->_id, "active": coalesce(active, true), passwordHash, "createdAt": _createdAt }`
  );
  return rows;
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const all = await listUsers();
  return all.find((u) => u.id === id) ?? null;
}

/** Used by the login route. Includes inactive users so the route can return a
 *  clear "deactivated" error instead of a generic 401. */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const all = await listUsers();
  return all.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function listActiveAgents(): Promise<UserRecord[]> {
  return (await listUsers()).filter((u) => u.role === "agent" && u.active);
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  assignedRegions?: string[];
  personalAssistantId?: string;
}

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  return withCreateLock(async () => {
    if (await findUserByEmail(input.email)) {
      throw new Error("A user with that email already exists.");
    }
    const record: UserRecord = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: input.name,
      email: input.email,
      role: input.role,
      assignedRegions: input.assignedRegions,
      personalAssistantId: input.personalAssistantId,
      active: true,
      passwordHash: await bcrypt.hash(input.password, 10),
      createdAt: new Date().toISOString(),
    };
    if (usingDevUsers) {
      const all = await devReadAll();
      await devWriteAll([...all, record]);
      return record;
    }
    const created = await sanity.create({
      _type: "user",
      name: record.name,
      email: record.email,
      role: record.role,
      assignedRegions: record.assignedRegions,
      active: true,
      passwordHash: record.passwordHash,
    });
    return { ...record, id: created._id };
  });
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  assignedRegions?: string[];
  personalAssistantId?: string;
  /** Set only if changing the password. Empty/undefined leaves it as-is. */
  password?: string;
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<UserRecord> {
  // Email change must still be unique.
  if (patch.email) {
    const other = await findUserByEmail(patch.email);
    if (other && other.id !== id) {
      throw new Error("Another user already uses that email.");
    }
  }
  if (usingDevUsers) {
    const all = await devReadAll();
    // Editing a seed for the first time: copy the seed's defaults into disk
    // so the change persists (listUsers prefers the disk copy on same id).
    let i = all.findIndex((u) => u.id === id);
    if (i === -1) {
      const seed = devSeedRecords().find((s) => s.id === id);
      if (!seed) throw new Error("User not found.");
      all.push(seed);
      i = all.length - 1;
    }
    const next: UserRecord = {
      ...all[i],
      seed: false, // no longer a pristine seed once edited
      name: patch.name ?? all[i].name,
      email: patch.email ?? all[i].email,
      role: patch.role ?? all[i].role,
      assignedRegions: patch.assignedRegions ?? all[i].assignedRegions,
      personalAssistantId: patch.personalAssistantId ?? all[i].personalAssistantId,
      passwordHash: patch.password
        ? await bcrypt.hash(patch.password, 10)
        : all[i].passwordHash,
    };
    all[i] = next;
    await devWriteAll(all);
    return next;
  }
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.email !== undefined) set.email = patch.email;
  if (patch.role !== undefined) set.role = patch.role;
  if (patch.assignedRegions !== undefined) set.assignedRegions = patch.assignedRegions;
  if (patch.password) set.passwordHash = await bcrypt.hash(patch.password, 10);
  const updated = await sanity.patch(id).set(set).commit();
  return (await getUser(updated._id))!;
}

/** Admin reset: picks a temp password, stores its hash, flags the user as
 *  must-change. Returns the plaintext temp so the caller can show it once. */
export async function resetUserPassword(
  id: string
): Promise<{ user: UserRecord; tempPassword: string }> {
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const updated = await writeUserMutation(id, { passwordHash, mustChangePassword: true });
  return { user: updated, tempPassword };
}

/** User self-change: requires the current password to succeed. Clears the
 *  must-change flag on success. */
export async function changeOwnPassword(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<UserRecord> {
  const user = await getUser(id);
  if (!user) throw new Error("User not found.");
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new Error("Current password is incorrect.");
  }
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  return writeUserMutation(id, { passwordHash, mustChangePassword: false });
}

/** Hard delete. Requires the caller to have already checked that no
 *  properties are assigned to the user. Seed users can't be hard-deleted
 *  because the code re-materialises them on every request — deactivate
 *  instead. */
export async function deleteUser(id: string): Promise<void> {
  if (usingDevUsers) {
    const seed = DEV_USERS.find((u) => u.id === id);
    const all = await devReadAll();
    const onDisk = all.some((u) => u.id === id);
    if (seed && !onDisk) {
      throw new Error(
        "Seed dev users can't be deleted — they're defined in code. Deactivate instead."
      );
    }
    if (seed) {
      throw new Error(
        "Seed dev users can't be deleted — they're defined in code. Deactivate instead."
      );
    }
    if (!onDisk) throw new Error("User not found.");
    await devWriteAll(all.filter((u) => u.id !== id));
    return;
  }
  await sanity.delete(id);
}

/** Shared mutation helper — keeps the seed-lifting logic in one place. */
async function writeUserMutation(
  id: string,
  patch: Partial<UserRecord>
): Promise<UserRecord> {
  if (usingDevUsers) {
    const all = await devReadAll();
    let i = all.findIndex((u) => u.id === id);
    if (i === -1) {
      const seed = devSeedRecords().find((s) => s.id === id);
      if (!seed) throw new Error("User not found.");
      all.push(seed);
      i = all.length - 1;
    }
    all[i] = { ...all[i], ...patch, seed: false };
    await devWriteAll(all);
    return all[i];
  }
  await sanity.patch(id).set(patch).commit();
  return (await getUser(id))!;
}

function generateTempPassword(): string {
  // 12 chars, ambiguous chars dropped for read-aloud-ability.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 3 || i === 7) out += "-";
  }
  return out;
}

/** Record a successful sign-in. Called from the login route after auth. */
export async function recordLogin(id: string): Promise<void> {
  try {
    await writeUserMutation(id, { lastLoginAt: new Date().toISOString() });
  } catch {
    /* non-fatal: never fail the login itself */
  }
}

export async function setUserActive(id: string, active: boolean): Promise<UserRecord> {
  if (usingDevUsers) {
    const all = await devReadAll();
    let i = all.findIndex((u) => u.id === id);
    if (i === -1) {
      // First mutation of a seed user: lift it to disk so the change persists.
      const seed = devSeedRecords().find((s) => s.id === id);
      if (!seed) throw new Error("User not found.");
      all.push(seed);
      i = all.length - 1;
    }
    all[i] = { ...all[i], active, seed: false };
    await devWriteAll(all);
    return all[i];
  }
  await sanity.patch(id).set({ active }).commit();
  return (await getUser(id))!;
}
