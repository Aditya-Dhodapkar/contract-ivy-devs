"use client";

// Top-level error boundary (Phase 3 — see error_handling.md §3.3 / M3). This
// catches a throw in the ROOT layout itself — the one place app/error.tsx
// can't reach, because that boundary lives *inside* the layout. When this
// renders, Next replaces the entire document, so it must supply its own
// <html>/<body> and CANNOT rely on globals.css / Tailwind (the layout that
// imports them was bypassed). Styling is therefore inline, using the brand
// tokens from app/globals.css so it still reads like Sansi.
//
// As with app/error.tsx the raw error is logged, never shown (§4D).

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgb(255 255 255)",
          color: "rgb(20 19 15)",
          fontFamily:
            "Mulish, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgb(139 132 120)",
            }}
          >
            Something went wrong
          </p>
          <h1
            style={{
              marginTop: "0.75rem",
              marginBottom: 0,
              fontWeight: 300,
              fontSize: "1.875rem",
              fontFamily:
                "'Cormorant Garamond', Garamond, serif",
            }}
          >
            The app hit a problem
          </h1>
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.875rem",
              color: "rgb(79 74 63)",
            }}
          >
            It wasn&apos;t anything you did. Please try again — if it keeps
            happening, refresh the page or sign in again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              border: "none",
              cursor: "pointer",
              background: "rgb(20 19 15)",
              color: "rgb(250 250 250)",
              padding: "0.625rem 1.5rem",
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
