"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const field =
  "w-full border border-hairline/20 bg-ivory px-3 py-2.5 text-base outline-none focus:border-gold";
const labelText = "mb-1 block text-eyebrow uppercase text-ink";

export function ProfileForms({
  initial,
  mustChangePassword,
}: {
  initial: { name: string; email: string };
  mustChangePassword: boolean;
}) {
  const router = useRouter();
  const [pIdMsg, setPIdMsg] = useState("");
  const [pIdErr, setPIdErr] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  async function saveIdentity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPIdMsg("");
    setPIdErr("");
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: f.get("name"), email: f.get("email") }),
    });
    if (res.ok) {
      setPIdMsg("Saved.");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setPIdErr(j.error || "Could not save.");
    }
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwMsg("");
    setPwErr("");
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: f.get("currentPassword"),
        newPassword: f.get("newPassword"),
      }),
    });
    if (res.ok) {
      setPwMsg("Password changed.");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setPwErr(j.error || "Could not change password.");
    }
  }

  return (
    <div className="space-y-20">
      {mustChangePassword && (
        <div className="border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold-deep">
          Your password was reset by the owner. Please set a new one below before continuing.
        </div>
      )}

      <form onSubmit={saveIdentity} className="space-y-7">
        <h2 className="font-serif text-2xl">Identity</h2>
        <label className="block">
          <span className={labelText}>Full name</span>
          <input name="name" defaultValue={initial.name} required className={field} />
        </label>
        <label className="block">
          <span className={labelText}>Email (your sign-in)</span>
          <input name="email" type="email" defaultValue={initial.email} required className={field} />
          <p className="mt-2 text-xs text-ash">
            Changing this changes how you sign in.
          </p>
        </label>
        {pIdErr && <p className="text-sm text-red-700">{pIdErr}</p>}
        {pIdMsg && <p className="text-sm text-gold-deep">{pIdMsg}</p>}
        <button className="bg-ink px-5 py-2.5 text-eyebrow uppercase text-paper hover:bg-gold-deep">
          Save
        </button>
      </form>

      <form onSubmit={changePassword} className="space-y-7 border-t border-hairline/15 pt-16">
        <h2 className="font-serif text-2xl">Change password</h2>
        <label className="block">
          <span className={labelText}>Current password</span>
          <input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className={field}
          />
        </label>
        <label className="block">
          <span className={labelText}>New password (min 8 characters)</span>
          <input
            name="newPassword"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            className={field}
          />
        </label>
        {pwErr && <p className="text-sm text-red-700">{pwErr}</p>}
        {pwMsg && <p className="text-sm text-gold-deep">{pwMsg}</p>}
        <button className="bg-ink px-5 py-2.5 text-eyebrow uppercase text-paper hover:bg-gold-deep">
          Change password
        </button>
      </form>
    </div>
  );
}
