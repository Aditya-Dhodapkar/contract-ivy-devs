"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeactivateButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (active && !confirm("Deactivate this user? They will no longer be able to sign in.")) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/users/${id}/deactivate`, {
      method: "POST",
      body: JSON.stringify({ active: !active }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Action failed.");
    }
  }

  return (
    <div>
      <button
        onClick={toggle}
        disabled={loading}
        className={
          active
            ? "w-full border border-hairline/30 px-3 py-2 text-eyebrow uppercase text-red-700 hover:bg-red-50 disabled:opacity-60"
            : "w-full bg-gold-deep px-3 py-2 text-eyebrow uppercase text-paper hover:bg-ink disabled:opacity-60"
        }
      >
        {loading ? "Working…" : active ? "Deactivate user" : "Reactivate user"}
      </button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
