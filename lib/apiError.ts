// Shared API error envelope for the add-property flow (Phase 1 of the error-
// handling upgrade — see error_handling.md §4A).
//
//   { error: string,                       // human, plain-language, always present
//     fields?: { [inputName]: string } }   // optional per-field messages
//
// `error` stays back-compatible with the form's existing `j.error` read. `fields`
// is additive: Phase 1 starts returning it, Phase 3 renders it inline. Field keys
// equal the form input `name` attributes (title, price, latitude, …), so a zod
// issue on `latitude` maps straight to that input.

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/** Map a zod validation failure to a 422 `{ error, fields }` response. The first
 *  issue's message becomes the top-level `error`; one message per top-level field
 *  is collected into `fields` (first issue wins per field). */
export function validationError(error: ZodError): NextResponse {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fields)) {
      fields[key] = issue.message;
    }
  }
  const first = error.issues[0]?.message ?? "Please check the form and try again.";
  return NextResponse.json({ error: first, fields }, { status: 422 });
}
