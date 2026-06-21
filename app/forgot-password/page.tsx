"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | "owner" | "other" | "error">(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErrorMsg(j.error || "Something went wrong. Try again.");
      setResult("error");
      return;
    }
    const j = await res.json().catch(() => ({}));
    setResult(j.ownerFlow ? "owner" : "other");
  }

  const field =
    "w-full border border-hairline/20 bg-ivory px-3.5 py-3 text-base text-ink outline-none transition-colors placeholder:text-ash/70 focus:border-gold";

  return (
    <main className="flex min-h-screen items-center justify-center bg-ivory px-6 py-12">
      <div className="w-full max-w-sm">
        <p className="text-eyebrow uppercase tracking-[0.3em] text-gold-deep">
          Sansi Africa
        </p>
        <h1 className="mt-3 font-serif text-4xl font-light text-ink">
          Reset password
        </h1>

        {result === "owner" ? (
          <p className="mt-6 border-l-2 border-gold bg-gold/5 px-4 py-3 text-sm leading-relaxed text-ink">
            A reset link has been sent to that email. Check your inbox — the link
            expires in 1 hour.
          </p>
        ) : result === "other" ? (
          <p className="mt-6 border-l-2 border-hairline/40 bg-paper px-4 py-3 text-sm leading-relaxed text-ink-mute">
            Only the account owner can reset their password here. If you&rsquo;re
            a team member, contact your account owner — they can reset your
            password for you.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-mute">
              Enter your email and we&rsquo;ll send a reset link.
            </p>
            <form onSubmit={onSubmit} className="mt-8">
              <label className="block">
                <span className="mb-1.5 block text-eyebrow uppercase text-ash">
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@sansi.africa"
                  className={field}
                />
              </label>
              {result === "error" && (
                <p className="mt-4 border-l-2 border-red-400 bg-red-50/60 px-3 py-2 text-sm text-red-700">
                  {errorMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mt-8 w-full bg-ink py-3.5 text-eyebrow uppercase tracking-[0.2em] text-paper transition-colors hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <p className="mt-8 text-sm">
          <Link href="/login" className="text-ink-mute underline hover:text-gold-deep">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
