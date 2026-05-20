"use client";

// Hard delete a team member. Owner only (server-enforced). Requires a strong
// confirmation because there is no undo — they'd have to be re-invited.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    const phrase = `delete ${userName.split(" ")[0].toLowerCase()}`;
    const typed = prompt(
      `Permanently delete ${userName}? They would have to be re-invited from scratch — this cannot be undone.\n\nType  ${phrase}  to confirm:`
    );
    if (typed?.trim().toLowerCase() !== phrase) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      router.push("/team");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not delete.");
    }
  }

  return (
    <div>
      <button
        onClick={onClick}
        disabled={loading}
        className="w-full border border-red-300 px-3 py-2 text-eyebrow uppercase text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {loading ? "Deleting…" : "Delete user"}
      </button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
