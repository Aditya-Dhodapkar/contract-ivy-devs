// Team member repository. Two interchangeable backends:
//   - dev:  .devdata/users.json + the seeds from lib/devUsers.ts
//   - prod: Supabase `users` table
//
// Hard rules (#6-#9):
//   - Soft deactivate by default (active flag); hard delete via deleteUser()
//   - Passwords are bcrypt hashed; plaintext never persisted
//   - Email uniqueness enforced at create (UNIQUE INDEX in prod, mutex in dev)

import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { usingDevData, DEV_USERS } from "@/lib/devUsers";
import { supabase } from "@/lib/supabase";
import { defaultGrantsFor, type Role } from "@/lib/roles";

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
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  /** Per-user capability grants set by the Owner (Team page). Each entry is a
   *  grantable capability key turned ON beyond the role default. */
  grants?: string[];
  /** Marks the 4 dev seed users (display only; only meaningful in dev mode). */
  seed?: boolean;
}

/* --------------------------- prod row mapping --------------------------- */

type Row = Record<string, unknown>;

function toRow(rec: Partial<UserRecord>): Row {
  return compact({
    id: rec.id,
    name: rec.name,
    email: rec.email,
    role: rec.role,
    assigned_regions: rec.assignedRegions,
    personal_assistant_id: rec.personalAssistantId,
    password_hash: rec.passwordHash,
    active: rec.active,
    must_change_password: rec.mustChangePassword,
    last_login_at: rec.lastLoginAt,
    created_at: rec.createdAt,
    grants: rec.grants,
  });
}

function fromRow(r: Row): UserRecord {
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    role: r.role as Role,
    assignedRegions: (r.assigned_regions as string[]) ?? undefined,
    personalAssistantId: (r.personal_assistant_id as string) ?? undefined,
    active: !!r.active,
    passwordHash: r.password_hash as string,
    createdAt: r.created_at as string,
    mustChangePassword: (r.must_change_password as boolean) ?? undefined,
    lastLoginAt: (r.last_login_at as string) ?? undefined,
    grants: (r.grants as string[]) ?? undefined,
  };
}

function compact<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/* ----------------------------- dev backend ----------------------------- */

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
    grants: defaultGrantsFor(u.role),
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

/** Combined list. In dev: seeds + custom users (custom shadows seed by id).
 *  In prod: straight from Supabase (no seeds). */
export async function listUsers(): Promise<UserRecord[]> {
  if (usingDevData) {
    const disk = await devReadAll();
    const diskIds = new Set(disk.map((u) => u.id));
    const seeds = devSeedRecords().filter((s) => !diskIds.has(s.id));
    return [...seeds, ...disk];
  }
  const { data, error } = await supabase()
    .from("users")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

export async function getUser(id: string): Promise<UserRecord | null> {
  if (usingDevData) {
    return (await listUsers()).find((u) => u.id === id) ?? null;
  }
  const { data, error } = await supabase()
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data) : null;
}

/** Used by the login route. Includes inactive users so the route can return a
 *  clear "deactivated" message rather than a generic 401. */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  if (usingDevData) {
    return (await listUsers()).find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  // Case-insensitive lookup matched the users_email_lower_uq index in migrations/001_init.sql.
  const { data, error } = await supabase()
    .from("users")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data) : null;
}

export async function listActiveAgents(): Promise<UserRecord[]> {
  if (usingDevData) {
    return (await listUsers()).filter((u) => u.role === "agent" && u.active);
  }
  const { data, error } = await supabase()
    .from("users")
    .select("*")
    .eq("role", "agent")
    .eq("active", true);
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
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
    // Role-based starting grants (e.g. Assistants can publish by default). The
    // Owner can revoke these later from the Team page.
    grants: defaultGrantsFor(input.role),
  };

  if (usingDevData) {
    return withCreateLock(async () => {
      if (await findUserByEmail(input.email)) {
        throw new Error("A user with that email already exists.");
      }
      const all = await devReadAll();
      await devWriteAll([...all, record]);
      return record;
    });
  }

  // Pre-check email uniqueness for a friendlier error; the UNIQUE INDEX is
  // the authoritative guard against a race.
  if (await findUserByEmail(input.email)) {
    throw new Error("A user with that email already exists.");
  }
  const { data, error } = await supabase()
    .from("users")
    .insert(toRow(record))
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("A user with that email already exists.");
    throw new Error(error.message);
  }
  return fromRow(data);
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  assignedRegions?: string[];
  personalAssistantId?: string;
  /** Set only if changing the password. Empty/undefined leaves it as-is. */
  password?: string;
  /** Replace the user's capability grants. Undefined leaves them as-is. */
  grants?: string[];
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<UserRecord> {
  if (patch.email) {
    const other = await findUserByEmail(patch.email);
    if (other && other.id !== id) {
      throw new Error("Another user already uses that email.");
    }
  }
  const passwordHash = patch.password ? await bcrypt.hash(patch.password, 10) : undefined;
  return writeUserMutation(id, {
    name: patch.name,
    email: patch.email,
    role: patch.role,
    assignedRegions: patch.assignedRegions,
    personalAssistantId: patch.personalAssistantId,
    passwordHash,
    grants: patch.grants,
  });
}

/** Admin reset: picks a temp password, stores its hash, flags as must-change.
 *  Returns the plaintext temp so the caller can show it once. */
export async function resetUserPassword(
  id: string
): Promise<{ user: UserRecord; tempPassword: string }> {
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const updated = await writeUserMutation(id, { passwordHash, mustChangePassword: true });
  return { user: updated, tempPassword };
}

/** Set a user's password to a known value (used by the forgot-password reset
 *  flow, after the reset token is verified). Clears must-change. Changing the
 *  hash also invalidates any outstanding reset token (see lib/passwordReset). */
export async function setUserPassword(
  id: string,
  newPassword: string
): Promise<UserRecord> {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  return writeUserMutation(id, { passwordHash, mustChangePassword: false });
}

/** User self-change: requires current password. Clears must-change on success. */
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

/** Hard delete. Caller must check no properties are assigned first. */
export async function deleteUser(id: string): Promise<void> {
  if (usingDevData) {
    const seed = DEV_USERS.find((u) => u.id === id);
    const all = await devReadAll();
    const onDisk = all.some((u) => u.id === id);
    if (seed) {
      throw new Error(
        "Seed dev users can't be deleted — they're defined in code. Deactivate instead."
      );
    }
    if (!onDisk) throw new Error("User not found.");
    await devWriteAll(all.filter((u) => u.id !== id));
    return;
  }
  const { error } = await supabase().from("users").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Shared mutation helper — handles dev seed-lifting and prod update. */
async function writeUserMutation(
  id: string,
  patch: Partial<UserRecord>
): Promise<UserRecord> {
  if (usingDevData) {
    const all = await devReadAll();
    let i = all.findIndex((u) => u.id === id);
    if (i === -1) {
      // First mutation of a seed user: lift it to disk so the change persists.
      const seed = devSeedRecords().find((s) => s.id === id);
      if (!seed) throw new Error("User not found.");
      all.push(seed);
      i = all.length - 1;
    }
    all[i] = { ...all[i], ...compact(patch), seed: false };
    await devWriteAll(all);
    return all[i];
  }
  const update = toRow(patch);
  if (Object.keys(update).length === 0) {
    // No real changes — just return the current record.
    const current = await getUser(id);
    if (!current) throw new Error("User not found.");
    return current;
  }
  const { data, error } = await supabase()
    .from("users")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data);
}

function generateTempPassword(): string {
  // 12 chars, ambiguous letters/numbers stripped for read-aloud-ability.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 3 || i === 7) out += "-";
  }
  return out;
}

/** Record a successful sign-in. Non-fatal — never fail the login itself. */
export async function recordLogin(id: string): Promise<void> {
  try {
    await writeUserMutation(id, { lastLoginAt: new Date().toISOString() });
  } catch {
    /* swallow */
  }
}

export async function setUserActive(id: string, active: boolean): Promise<UserRecord> {
  return writeUserMutation(id, { active });
}
