"use client";

// Route-level error boundary (Phase 3 — see error_handling.md §3.3 / M3). Next
// 15 App Router renders this in place of any route segment under app/ whose
// render throws (server or client component), instead of an unstyled crash.
// It renders *inside* the root layout, so globals.css / Tailwind apply.
//
// The raw error goes to the console / server log only — never to a
// non-technical user (§4D). The user gets a plain message, a "Try again"
// (calls reset(), which re-renders the segment) and a way back to safety so
// nothing is ever a dead end.

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-6">
      <div className="max-w-md text-center">
        <p className="text-eyebrow uppercase text-ash">Something went wrong</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-ink sm:text-4xl">
          This page hit a problem
        </h1>
        <p className="mt-3 text-sm text-ink-mute">
          It wasn&apos;t anything you did — something on our side didn&apos;t
          load properly. You can try again, or head back to your properties.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="bg-ink px-6 py-2.5 text-eyebrow uppercase text-paper hover:bg-gold-deep"
          >
            Try again
          </button>
          <Link
            href="/properties"
            className="border border-hairline/25 px-6 py-2.5 text-eyebrow uppercase text-ink-mute hover:bg-paper"
          >
            Go to properties
          </Link>
        </div>
      </div>
    </div>
  );
}
