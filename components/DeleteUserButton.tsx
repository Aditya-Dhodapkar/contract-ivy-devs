"use client";

// Hard delete a team member. Owner-only (server-enforced). Requires typing
// "delete <firstname>" in a themed modal — typo-proof and styled to match.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModalShell, modalBtnCancel, modalBtnDanger } from "./ModalShell";

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const firstName = userName.trim().split(" ")[0].toLowerCase();
  const phrase = `delete ${firstName}`;
  const canDelete = typed.trim().toLowerCase() === phrase;

  function openModal() {
    setOpen(true);
    setTyped("");
    setError("");
  }

  async function doDelete() {
    if (!canDelete) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/team");
      router.refresh();
      return; // keep modal open; navigation unmounts it
    }
    setLoading(false);
    const j = await res.json().catch(() => ({}));
    setError(j.error || "Could not delete.");
  }

  return (
    <>
      <button
        onClick={openModal}
        className="w-full border border-red-300 px-3 py-2 text-eyebrow uppercase text-red-700 hover:bg-red-50"
      >
        Delete user
      </button>
      <ModalShell
        open={open}
        onClose={() => !loading && setOpen(false)}
        title={`Delete ${userName}?`}
        actions={
          <>
            <button onClick={() => setOpen(false)} className={modalBtnCancel} disabled={loading}>
              Cancel
            </button>
            <button onClick={doDelete} disabled={!canDelete || loading} className={modalBtnDanger}>
              {loading ? "Deleting…" : "Delete user"}
            </button>
          </>
        }
      >
        <p>They would have to be re-invited from scratch. This can't be undone.</p>
        <p className="mt-4">
          Type <span className="font-mono text-ink">{phrase}</span> below to confirm:
        </p>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canDelete) doDelete();
          }}
          className="mt-2 w-full border border-hairline/25 bg-ivory px-3 py-2 text-sm outline-none focus:border-gold"
          placeholder={phrase}
        />
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </ModalShell>
    </>
  );
}
