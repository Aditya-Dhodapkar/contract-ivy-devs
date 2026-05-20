"use client";

// Owner-only password reset trigger. Generates a temp password on the server,
// returns it once, displays it inline so the Owner can copy/share.

import { useState } from "react";

export function ResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [loading, setLoading] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function reset() {
    if (!confirm(
      `Reset ${userName}'s password? They will be prompted to set a new one on next sign-in.`
    )) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/users/${userId}/reset-password`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      const { tempPassword } = await res.json();
      setTemp(tempPassword);
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Reset failed.");
    }
  }

  if (temp) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-ash">Temporary password (shown once):</p>
        <div className="select-all border border-gold/40 bg-gold/10 px-3 py-2 font-mono text-sm text-ink">
          {temp}
        </div>
        <p className="text-xs text-ink-mute">
          Share with {userName}. They'll be prompted to change it on next sign-in.
        </p>
        <button
          onClick={() => navigator.clipboard?.writeText(temp)}
          className="text-eyebrow uppercase text-gold-deep hover:underline"
        >
          Copy
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={reset}
        disabled={loading}
        className="w-full border border-hairline/30 px-3 py-2 text-eyebrow uppercase text-ink-mute hover:bg-ivory-deep disabled:opacity-60"
      >
        {loading ? "Resetting…" : "Reset password"}
      </button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
