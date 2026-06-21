"use client";

// Persistent "Send feedback" button in the back-office header. Opens a
// modal that lets the user file a bug, feature request, or general note
// (with optional screenshots). On submit, /api/feedback creates a real
// issue in the dev's GitHub repo — Carol & team never see GitHub; to
// them the feedback just "lands with the developer".

import { useRef, useState } from "react";
import Link from "next/link";
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
  const [success, setSuccess] = useState<{ number?: number } | null>(null);

  // Voice note recording state.
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const MAX_SECONDS = 180; // 3-minute cap keeps the payload sane

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopRecording() {
    recorderRef.current?.stop(); // fires onstop → builds the blob, releases mic
    setRecording(false);
    stopTimer();
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find(
        (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)
      );
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const type = mr.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        setAudioBlob(blob);
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
      let secs = 0;
      setElapsed(0);
      timerRef.current = setInterval(() => {
        secs += 1;
        setElapsed(secs);
        if (secs >= MAX_SECONDS) {
          mr.stop();
          setRecording(false);
          stopTimer();
        }
      }, 1000);
    } catch {
      setError("Couldn't access the microphone — check your browser's mic permission.");
    }
  }

  function removeAudio() {
    setAudioBlob(null);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setElapsed(0);
  }

  function fmt(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function reset() {
    if (recording) stopRecording();
    setCategory("bug");
    setTitle("");
    setBody("");
    setImages([]);
    removeAudio();
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
  async function fileToB64(f: Blob, name: string): Promise<{ name: string; type: string; base64: string }> {
    const buf = await f.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { name, type: f.type || "application/octet-stream", base64: btoa(binary) };
  }

  async function submit() {
    if (!title.trim()) {
      setError("Please add a short title.");
      return;
    }
    if (!body.trim() && !audioBlob) {
      setError("Add some details, or record a voice note.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const encoded = await Promise.all(
        images.map((f) => fileToB64(f, f.name))
      );
      let audio: { name: string; type: string; base64: string } | undefined;
      if (audioBlob) {
        const ext = audioBlob.type.includes("mp4")
          ? "mp4"
          : audioBlob.type.includes("ogg")
            ? "ogg"
            : "webm";
        audio = await fileToB64(audioBlob, `voice-note.${ext}`);
      }
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          body: body.trim(),
          images: encoded,
          audio,
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
                disabled={busy || !title.trim() || (!body.trim() && !audioBlob)}
              >
                {busy ? "Sending…" : "Send"}
              </button>
            </>
          )
        }
      >
        {success ? (
          <div className="space-y-4">
            <p>
              Your note has been logged with the developer
              {success.number ? ` (ref #${success.number})` : ""}. They&rsquo;ll
              get back to you. Feel free to send another any time.
            </p>
            <Link
              href="/feedback-log"
              onClick={close}
              className="inline-block text-eyebrow uppercase text-gold-deep underline-offset-2 hover:underline"
            >
              View my feedback log →
            </Link>
          </div>
        ) : (
          <div className="space-y-5 text-ink">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-mute">
                Bug, idea, question — anything. The developer sees it directly.
              </p>
              <Link
                href="/feedback-log"
                onClick={close}
                className="shrink-0 text-eyebrow uppercase text-gold-deep underline-offset-2 hover:underline"
              >
                My feedback →
              </Link>
            </div>

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
                placeholder="What happened, what you expected, anything else useful. (Or record a voice note below instead.)"
                className={field}
              />
            </label>

            <div className="block">
              <span className="mb-2 block text-eyebrow uppercase">Voice note (optional)</span>
              <p className="mb-2 text-xs text-ink-mute">
                Prefer to talk? Record your idea or issue instead of typing it.
              </p>
              {!audioBlob ? (
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  className={
                    recording
                      ? "inline-flex items-center gap-2 border border-red-400 bg-red-50 px-4 py-2 text-eyebrow uppercase text-red-700"
                      : "inline-flex items-center gap-2 border border-hairline/30 bg-paper px-4 py-2 text-eyebrow uppercase text-ink hover:bg-ivory-deep"
                  }
                >
                  {recording ? (
                    <>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden />
                      Stop · {fmt(elapsed)}
                    </>
                  ) : (
                    <>
                      <span aria-hidden>🎙️</span> Record voice note
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={audioUrl} className="w-full" />
                  <button
                    type="button"
                    onClick={removeAudio}
                    className="text-xs text-ash hover:text-red-700"
                  >
                    Remove &amp; re-record
                  </button>
                </div>
              )}
              {recording && (
                <p className="mt-1.5 text-xs text-ash">
                  Recording… up to {MAX_SECONDS / 60} minutes, then it stops automatically.
                </p>
              )}
            </div>

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
