"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const field =
  "w-full border border-hairline/20 bg-ivory px-3.5 py-3 text-base text-ink outline-none transition-colors placeholder:text-ash/70 focus:border-gold";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
      return;
    }
    const j = await res.json().catch(() => ({}));
    setError(j.error || "Could not reset your password.");
  }

  if (!token) {
    return (
      <p className="mt-6 border-l-2 border-red-400 bg-red-50/60 px-4 py-3 text-sm text-red-700">
        This link is missing its reset token. Request a new one from the{" "}
        <Link href="/forgot-password" className="underline">
          forgot-password page
        </Link>
        .
      </p>
    );
  }

  if (done) {
    return (
      <p className="mt-6 border-l-2 border-gold bg-gold/5 px-4 py-3 text-sm leading-relaxed text-ink">
        Password updated. Taking you to sign in…
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8">
      <label className="block">
        <span className="mb-1.5 block text-eyebrow uppercase text-ash">New password</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="••••••••" className={field} />
      </label>
      <label className="mt-5 block">
        <span className="mb-1.5 block text-eyebrow uppercase text-ash">Confirm password</span>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" placeholder="••••••••" className={field} />
      </label>
      {error && (
        <p className="mt-4 border-l-2 border-red-400 bg-red-50/60 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="mt-8 w-full bg-ink py-3.5 text-eyebrow uppercase tracking-[0.2em] text-paper transition-colors hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ivory px-6 py-12">
      <div className="w-full max-w-sm">
        <p className="text-eyebrow uppercase tracking-[0.3em] text-gold-deep">Sansi Africa</p>
        <h1 className="mt-3 font-serif text-4xl font-light text-ink">Set a new password</h1>
        <Suspense fallback={<p className="mt-6 text-sm text-ink-mute">Loading…</p>}>
          <ResetForm />
        </Suspense>
        <p className="mt-8 text-sm">
          <Link href="/login" className="text-ink-mute underline hover:text-gold-deep">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
