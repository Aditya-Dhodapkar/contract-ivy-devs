"use client";

import { useState } from "react";

export function FeedbackDoneToggle({
  id,
  initialDone,
}: {
  id: string;
  initialDone: boolean;
}) {
  const [done, setDone] = useState(initialDone);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !done;
    setBusy(true);
    setDone(next); // optimistic
    const res = await fetch(`/api/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: next }),
    });
    setBusy(false);
    if (!res.ok) setDone(!next); // revert on failure
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={done}
        disabled={busy}
        onChange={toggle}
        className="h-4 w-4 accent-gold-deep"
      />
      <span className={done ? "text-green-700" : "text-ink-mute"}>
        {done ? "Done" : "Mark done"}
      </span>
    </label>
  );
}
