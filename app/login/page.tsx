"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("Wrong email or password.");
    }
  }

  const fieldLabel = "mb-1.5 block text-eyebrow uppercase text-ash";
  const field =
    "w-full border border-hairline/20 bg-ivory px-3.5 py-3 text-base text-ink outline-none transition-colors placeholder:text-ash/70 focus:border-gold";

  return (
    <main className="flex min-h-screen">
      {/* Brand panel — luxury left side, hidden on small screens */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-gold/10 bg-gradient-to-br from-[#1a1a1a] via-[#101010] to-black p-14 text-paper lg:flex">
        {/* single restrained gold glow for depth */}
        <div
          className="pointer-events-none absolute -right-40 -top-32 h-[34rem] w-[34rem] rounded-full bg-gold/10 blur-[140px]"
          aria-hidden
        />
        {/* faint vignette to settle the edges */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.5))]"
          aria-hidden
        />

        <p className="relative text-eyebrow uppercase tracking-[0.35em] text-gold">
          Sansi Africa
        </p>

        <div className="relative">
          <h2 className="font-serif text-6xl font-light leading-[1.05] text-paper">
            Luxury homes,
            <br />
            quietly managed.
          </h2>
          <div className="mt-7 h-px w-16 bg-gold" />
        </div>

        <p className="relative text-xs tracking-wide text-paper/35">
          © Sansi Africa · Confidential
        </p>
      </aside>

      {/* Form panel */}
      <section className="relative flex w-full items-center justify-center bg-ivory px-6 py-12 lg:w-1/2">
        {/* Brand logo — top-right corner of the white panel */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sansi-logo.jpg"
          alt="Sansi Africa"
          className="absolute right-8 top-8 h-28 w-28 object-contain"
        />

        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <p className="text-eyebrow uppercase text-ash">Welcome back</p>
          <h1 className="mt-3 font-serif text-4xl font-light text-ink">
            Back office
          </h1>
          <p className="mt-2 text-sm text-ink-mute">
            Sign in to continue. Staff access only.
          </p>

          <div className="mt-10 space-y-5">
            <label className="block">
              <span className={fieldLabel}>Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@sansi.africa"
                className={field}
              />
            </label>
            <label className="block">
              <span className={fieldLabel}>Password</span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={field}
              />
            </label>
          </div>

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
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="mt-5 text-center text-sm">
            <Link
              href="/forgot-password"
              className="text-ink-mute underline-offset-2 hover:text-gold-deep hover:underline"
            >
              Forgot password?
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
