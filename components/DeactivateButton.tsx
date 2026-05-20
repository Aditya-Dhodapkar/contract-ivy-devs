"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModalShell, modalBtnCancel, modalBtnDanger } from "./ModalShell";

export function DeactivateButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/users/${id}/deactivate`, {
      method: "POST",
      body: JSON.stringify({ active: !active }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Action failed.");
    }
  }

  return (
    <>
      <button
        onClick={() => {
          // Reactivation is harmless — no confirm needed; do it immediately.
          if (!active) return go();
          setOpen(true);
          setError("");
        }}
        disabled={loading}
        className={
          active
            ? "w-full border border-hairline/30 px-3 py-2 text-eyebrow uppercase text-red-700 hover:bg-red-50 disabled:opacity-60"
            : "w-full bg-gold-deep px-3 py-2 text-eyebrow uppercase text-paper hover:bg-ink disabled:opacity-60"
        }
      >
        {loading ? "Working…" : active ? "Deactivate user" : "Reactivate user"}
      </button>
      {!open && error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <ModalShell
        open={open}
        onClose={() => !loading && setOpen(false)}
        title="Deactivate this user?"
        actions={
          <>
            <button onClick={() => setOpen(false)} className={modalBtnCancel} disabled={loading}>
              Cancel
            </button>
            <button onClick={go} className={modalBtnDanger} disabled={loading}>
              {loading ? "Working…" : "Deactivate"}
            </button>
          </>
        }
      >
        <p>They won't be able to sign in until you reactivate them. Their record stays intact.</p>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </ModalShell>
    </>
  );
}
