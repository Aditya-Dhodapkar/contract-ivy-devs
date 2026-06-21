"use client";

// Create / edit a team member. Password required on create, optional on edit
// (leave blank to keep the existing one). assignedRegions only meaningful for
// agents — shown for that role, ignored otherwise on the server.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ROLE_LABELS,
  GRANTABLE_CAPABILITIES,
  permissionsFor,
  type Role,
} from "@/lib/roles";
import { ChipInput } from "@/components/ChipInput";

interface ExistingUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedRegions?: string[];
  active: boolean;
  seed?: boolean;
  grants?: string[];
}

const field =
  "w-full border border-hairline/20 bg-ivory px-3 py-2.5 text-base outline-none focus:border-gold";
const labelText = "mb-2 block text-eyebrow uppercase text-ink";

export function UserForm({
  existing,
  canEditPermissions = false,
}: {
  existing?: ExistingUser;
  /** Owner-only: show the per-user capability grants editor. */
  canEditPermissions?: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(existing?.role ?? "agent");
  const [regions, setRegions] = useState<string[]>(existing?.assignedRegions ?? []);
  const [grants, setGrants] = useState<string[]>(existing?.grants ?? []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  const toggleGrant = (key: string) =>
    setGrants((g) => (g.includes(key) ? g.filter((k) => k !== key) : [...g, key]));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") || "");
    const payload: Record<string, unknown> = {
      name: f.get("name"),
      email: f.get("email"),
      role,
      assignedRegions: role === "agent" ? regions : [],
    };
    if (!existing || password) payload.password = password;
    // Only send grants when the Owner is editing them (server is owner-gated).
    if (canEditPermissions) payload.grants = grants;

    const res = await fetch(
      existing ? `/api/users/${existing.id}` : "/api/users",
      {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      }
    );
    if (res.ok) {
      const j = await res.json();
      router.push(`/team/${j.user.id}?${existing ? "saved" : "created"}=1`);
      router.refresh();
      return;
    }
    const j = await res.json().catch(() => ({}));
    setError(j.error || "Could not save.");
    setSaving(false);
    submitting.current = false;
  }

  const v = existing;

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-7">
      <label className="block">
        <span className={labelText}>Full name</span>
        <input name="name" defaultValue={v?.name} required className={field} />
      </label>

      <label className="block">
        <span className={labelText}>Email</span>
        <input
          name="email"
          type="email"
          defaultValue={v?.email}
          required
          className={field}
        />
        {existing && (
          <p className="mt-1 text-xs text-ash">
            This is their sign-in email. Changing it changes how they log in — let them know.
          </p>
        )}
      </label>

      {!existing && (
        <label className="block">
          <span className={labelText}>Initial password</span>
          <input
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            className={field}
          />
          <p className="mt-1 text-xs text-ash">
            Share this with them once. They can change it from their profile after signing in.
          </p>
        </label>
      )}

      <label className="block">
        <span className={labelText}>Role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className={field}
        >
          {(["owner", "assistant", "general_manager", "agent"] as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </label>

      {role === "agent" && (
        <div>
          <span className={labelText}>Assigned regions / cities</span>
          <ChipInput
            value={regions}
            onChange={setRegions}
            placeholder="Add a city, press Enter…"
          />
          <p className="mt-1 text-xs text-ash">
            Leads about properties in these cities will route to this agent.
          </p>
        </div>
      )}

      {canEditPermissions && (
        <div className="border-t border-hairline/15 pt-6">
          <span className={labelText}>Permissions</span>
          <p className="mb-3 text-xs text-ash">
            Grant abilities beyond what this role includes by default. Turn on
            only what they need.
          </p>
          <div className="space-y-3">
            {GRANTABLE_CAPABILITIES.map((cap) => {
              const roleValue = permissionsFor(role)[cap.key];
              // The role already fully covers this capability — granting is a
              // no-op, so show it as included rather than an editable toggle.
              const includedInRole = roleValue === true || roleValue === "all";
              const checked = includedInRole || grants.includes(cap.key);
              return (
                <label key={cap.key} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={includedInRole}
                    onChange={() => toggleGrant(cap.key)}
                    className="mt-0.5 h-4 w-4 accent-gold-deep disabled:opacity-50"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-ink">{cap.label}</span>
                    <span className="block text-xs text-ink-mute">
                      {cap.description}
                      {includedInRole && (
                        <span className="text-ash"> · already included in this role</span>
                      )}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        disabled={saving}
        className="bg-ink px-6 py-2.5 text-eyebrow uppercase text-paper hover:bg-gold-deep disabled:opacity-50"
      >
        {saving ? "Saving" : existing ? "Save changes" : "Create user"}
      </button>
    </form>
  );
}
