"use client";

// Persistent "Send feedback" button in the back-office header. Opens a
// modal that lets the user file a bug, feature request, or general note
// (with optional screenshots). On submit, /api/feedback creates a real
// issue in the dev's GitHub repo — Carol & team never see GitHub; to
// them the feedback just "lands with the developer".

import { useState } from "react";
import { ModalShell, modalBtnCancel, modalBtnPrimary } from "@/components/ModalShell";

type Category = "bug" | "feature" | "other";

const CATEGORY_LABEL: Record<Category, string> = {
  bug: "Something's broken",
  feature: "Idea or feature request",
  other: "Other / question",
};

const field =
  "w-full border border-hairline/25 bg-ivory px-3 py-2.5 text-base text-ink outline-none focus:border-gold";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ number: number } | null>(null);

  function reset() {
    setCategory("bug");
    setTitle("");
    setBody("");
    setImages([]);
    setError("");
    setSuccess(null);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    // Defer reset so the modal animates out cleanly.
    setTimeout(reset, 200);
  }

  // Convert each image to base64 so the API route can hand it straight to
  // GitHub's contents API without doing FormData parsing on the server.
  async function fileToB64(f: File): Promise<{ name: string; type: string; base64: string }> {
    const buf = await f.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { name: f.name, type: f.type || "application/octet-stream", base64: btoa(binary) };
  }

  async function submit() {
    if (!title.trim() || !body.trim()) {
      setError("Please add a short title and a description.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const encoded = await Promise.all(images.map(fileToB64));
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          body: body.trim(),
          images: encoded,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Submit failed (HTTP ${res.status}).`);
      setSuccess({ number: j.number });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Report a bug or share feedback with the developer"
        className="inline-flex items-center gap-1.5 border border-gold-deep bg-gold-deep px-3 py-1.5 text-eyebrow uppercase text-paper shadow-sm transition-colors hover:bg-ink hover:border-ink"
      >
        <span aria-hidden>✎</span>
        <span>Feedback</span>
      </button>

      <ModalShell
        open={open}
        onClose={close}
        title={success ? "Feedback sent. Thanks." : "Send feedback to the developer"}
        actions={
          success ? (
            <button onClick={close} className={modalBtnPrimary}>
              Close
            </button>
          ) : (
            <>
              <button onClick={close} className={modalBtnCancel} disabled={busy}>
                Cancel
              </button>
              <button
                onClick={submit}
                className={modalBtnPrimary}
                disabled={busy || !title.trim() || !body.trim()}
              >
                {busy ? "Sending…" : "Send"}
              </button>
            </>
          )
        }
      >
        {success ? (
          <p>
            Your note has been logged with the developer (ref #{success.number}).
            They'll get back to you. Feel free to send another any time you spot
            something or have an idea.
          </p>
        ) : (
          <div className="space-y-5 text-ink">
            <p className="text-sm text-ink-mute">
              Bug, feature idea, question, anything — drop it here. The developer
              will see it directly. Add a screenshot if it'll help.
            </p>

            <label className="block">
              <span className="mb-2 block text-eyebrow uppercase">Type</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className={field}
              >
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((k) => (
                  <option key={k} value={k}>
                    {CATEGORY_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-eyebrow uppercase">Short title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Save button stays on 'Saving…' forever"
                className={field}
                maxLength={140}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-eyebrow uppercase">Details</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="What happened, what you expected, anything else useful."
                className={field}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-eyebrow uppercase">
                Screenshots {images.length > 0 && `(${images.length})`}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  // Cap each image at ~5 MB so the JSON payload stays sane.
                  const ok = files.filter((f) => f.size <= 5 * 1024 * 1024);
                  if (ok.length < files.length) {
                    setError("Some images were skipped — please keep each one under 5 MB.");
                  }
                  setImages((curr) => [...curr, ...ok]);
                  e.target.value = "";
                }}
                className="block w-full text-xs text-ink-mute file:mr-3 file:border file:border-hairline/30 file:bg-paper file:px-3 file:py-1.5 file:text-eyebrow file:uppercase file:text-ink hover:file:bg-ivory-deep"
              />
              {images.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-ink-mute">
                  {images.map((f, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="truncate">
                        {f.name} <span className="text-ash">· {Math.round(f.size / 1024)} KB</span>
                      </span>
                      <button
                        onClick={() => setImages((curr) => curr.filter((_, idx) => idx !== i))}
                        className="ml-3 text-ash hover:text-red-700"
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </label>

            {error && (
              <p className="border-l-2 border-red-300 bg-red-50/60 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>
        )}
      </ModalShell>
    </>
  );
}
