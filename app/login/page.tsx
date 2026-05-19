"use client";

import { useState } from "react";
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-ivory p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm border border-hairline/15 bg-paper px-9 py-12"
      >
        <p className="text-eyebrow uppercase text-ash">Sansi Africa</p>
        <h1 className="mt-3 font-serif text-3xl text-ink">Back office</h1>
        <p className="mt-1 text-sm text-ink-mute">Staff access only.</p>

        <div className="mt-9 space-y-3">
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full border border-hairline/20 bg-ivory px-3 py-2.5 text-sm outline-none focus:border-gold"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full border border-hairline/20 bg-ivory px-3 py-2.5 text-sm outline-none focus:border-gold"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-7 w-full bg-ink py-3 text-eyebrow uppercase text-paper transition-colors hover:bg-gold-deep disabled:opacity-60"
        >
          {loading ? "Signing in" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
