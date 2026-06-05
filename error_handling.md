# Error Handling Upgrade — Add-Property Flow

A phased, multi-chat implementation plan to make the **add-property** experience
robust, graceful, and self-explanatory for a **non-technical back-office team**.
Goal: a user can never hit a dead-end, never silently lose work, never create
junk data, and always understand what went wrong in plain language.

> Scope is the add-property path end-to-end: the form
> (`components/PropertyForm.tsx`), the create/update API routes, the upload
> route, the storage adapter, and the repo layer. The same patterns should be
> reused elsewhere later, but this plan only commits to the add-property flow.

---

## 0 · HOW TO USE THIS DOCUMENT (read first, every time)

This plan is executed across **three separate Claude Code chats — one per
phase** — so each chat keeps maximum context for its slice. To make that work:

**At the START of any phase chat, do these in order:**
1. Read this entire file top to bottom.
2. Read the **Progress Ledger** (§7) for all prior phases. If the immediately
   preceding phase is **not marked `COMPLETE`**, stop and tell the user.
3. Treat **the code + git history as the source of truth**, not just the ledger.
   Run `git log --oneline -20` and `git diff --stat <prev-phase-commit>..HEAD`
   to see what actually changed. The ledger is a summary; the repo is the truth.
4. Read the actual source files your phase touches (listed per phase). Do not
   rely on snippets in this doc — they may have drifted.
5. Confirm the dev server is running (§5) and `npx tsc --noEmit` is clean
   **before** you start, so you can attribute any new errors to your work.

**At the END of your phase:**
1. Make all changes, then run the full **Testing Protocol** for your phase.
2. Update the **Progress Ledger** (§7) using the template — this is mandatory
   and is how the next chat understands what you did and decided.
3. Tick the boxes in the **Status at a glance** table (§3).
4. Leave `npx tsc --noEmit` clean and the dev server runnable.

**Vague-on-purpose:** Some tasks below are intentionally not fully specified and
are marked **🔎 INVESTIGATE**. These require the implementing chat to read the
code, weigh trade-offs, and decide. Record the decision in the ledger.

---

## 1 · PROJECT CONTEXT (orientation for a fresh chat)

- **What this is:** `contract-ivy-devs` is the **Sansi Africa** real-estate
  back-office (Next.js 15 App Router + React 19 + TypeScript + Tailwind). It is
  **NOT** "Playr" (the parent folder is shared, but they are different products;
  the root `CLAUDE.md` describes Playr and its migration policy — **those do not
  apply here**). Sansi has its own `HANDOFF.md`, `deliverables.md`, and
  `migrations/`.
- **Backend in use:** Dev JSON backend. `USE_DEV_DATA=true` writes records to
  `.devdata/properties.json` (gitignored). The Supabase prod path exists in code
  but is **unprovisioned and untested** (blocked on the client).
- **⚠️ Supabase MCP caveat:** The only project reachable via the Supabase MCP is
  **"PLAYR"** (`frkrlsqzaumdynuxqhrw`) — a *different* product. **Never run Sansi
  SQL, migrations, or test data against it.** For these phases, the dev JSON
  backend is authoritative. Supabase MCP is used only for the limited,
  read-only checks described in §6.
- **Read for background:** `HANDOFF.md` (architecture + "things not to break"
  §10), `deliverables.md` (pre-publish checklist items #52–62 matter here).

### Architecture guardrails — do NOT break these
- `lib/roles.ts` is the single RBAC source of truth; `lib/guard.ts` gates routes.
- `referenceNumber` and `approval` are immutable via generic PATCH (stripped in
  `lib/repo/properties.ts`). Don't let validation reintroduce them.
- Existing **double-submit defense** (idempotency key + `useRef` lock + server
  idempotency lookup + dev mutex) must keep working.
- Existing **cover orientation guard** (landscape can't be primary) must keep
  working.
- Match the existing **zod error pattern** (see §4) — don't invent a new one.

---

## 2 · FINDINGS REFERENCE (the original review)

Severity-ranked. File:line are starting points — verify before trusting.

| ID | Sev | Finding | Primary location |
|----|-----|---------|------------------|
| C1 | 🔴 | Submit `fetch` has no try/catch → a network failure locks the button on "Saving" forever and loses the form. | `PropertyForm.tsx` `onSubmit` (~463–532, esp. 513) |
| C2 | 🔴 | No required-field validation (client, route, or repo) → empty form creates a blank, reference-numbered ghost property. | form has no `required`; `api/properties/route.ts:16–27`; `repo.createProperty` |
| H1 | 🟠 | Create route has no try/catch → every backend error becomes generic "Could not save." | `api/properties/route.ts:25` |
| H2 | 🟠 | Batch photo upload is `Promise.all` → one bad file discards the whole batch incl. successes. | `PropertyForm.tsx:334–362` (and `uploadFloorPlans` 405–438) |
| H3 | 🟠 | Submit not blocked while uploads are in flight → photos silently missing from the saved record. | submit disabled only on `saving` (1189); ignores `uploading`/`uploadingFloorPlan` |
| H4 | 🟠 | HEIC (iPhone default) previews break in-browser + `sharp` HEIC failure can bypass the cover guard. | `api/upload/route.ts:48–56`; `PropertyForm.tsx:880–896` |
| M1 | 🟡 | No range/sanity checks: negative bedrooms/price, out-of-range lat/lng, absurd years. | number inputs' min/max don't constrain typed/pasted values |
| M2 | 🟡 | Coordinate paste fails silently — users paste "lat, lng" into a `type=number` field → dropped. | `PropertyForm.tsx:1003–1030` |
| M3 | 🟡 | No error boundaries (`error.tsx` / `global-error.tsx`) → server-component throw = unstyled crash. | none exist in `app/` |
| M4 | 🟡 | Enter in any single-line input submits the long form → premature half-filled create. | native form submit |
| M5 | 🟡 | Only error indicator is a small red line at the very bottom; no scroll-to-error. | `PropertyForm.tsx:1186` |
| M6 | 🟡 | No unsaved-changes guard → back/close loses everything. | none |
| L1 | 🟢 | `/api/agents` failure silently shows an empty dropdown with no explanation. | `PropertyForm.tsx:74–80` |
| L2 | 🟢 | `assignedAgentId` trusted server-side — no check it's a real active agent. | `api/properties/route.ts:22–23` |
| L3 | 🟢 | No server-side shape validation (zod) on properties routes (auth/users routes have it). | `api/properties/route.ts` |
| L4 | 🟢 | Create fetch missing `Content-Type: application/json` header (works only by luck). | `PropertyForm.tsx:513–519` |
| L5 | 🟢 | `uploading` counter inaccurate under concurrent batches. | `PropertyForm.tsx:333,360` |
| L6 | 🟢 | Oversize/wrong-type feedback only after a full upload round-trip. | client has no pre-check |

---

## 3 · STATUS AT A GLANCE (tick as you go)

| Finding | Phase | Done |
|---------|-------|------|
| C1 submit reliability | 1 | ☑ |
| C2 required fields (server gate) | 1 | ☑ |
| H1 route try/catch | 1 | ☑ |
| L2 agent validation | 1 | ☑ |
| L3 zod schema | 1 | ☑ |
| L4 content-type header | 1 | ☑ |
| H2 partial-success upload | 2 | ☑ |
| H3 block submit during upload | 2 | ☑ |
| H4 HEIC handling | 2 | ☑ |
| L5 upload counter | 2 | ☑ |
| L6 client pre-check | 2 | ☑ |
| C2 required fields (inline UX) | 3 | ☑ |
| M1 range errors (client display) | 3 | ☑ |
| M2 coord paste | 3 | ☑ |
| M3 error boundaries | 3 | ☑ |
| M4 Enter guard | 3 | ☑ |
| M5 scroll-to-error | 3 | ☑ |
| M6 unsaved-changes guard | 3 | ☑ |
| L1 agent-list failure notice | 3 | ☑ |

---

## 4 · CANONICAL PATTERNS (use these in every phase, don't reinvent)

**A. The error envelope.** Every API error response is JSON of this shape:

```
{ "error": string,                       // human, plain-language, always present
  "fields"?: { [inputName: string]: string } }  // optional per-field messages
```

`error` is back-compatible with the form's current `j.error` read. `fields` is
**additive** — Phase 1 starts returning it; Phase 3 consumes it for inline
display. Field keys must match the form input `name` attributes
(`title`, `price`, `latitude`, …).

**B. The zod validate-then-try pattern** (copied from `app/api/users/route.ts`):

```
const parsed = Schema.safeParse(await req.json().catch(() => null));
if (!parsed.success) {
  // map zod issues → { error, fields }
  return NextResponse.json({ error: <first message>, fields: <map> }, { status: 422 });
}
try {
  const created = await repoCall(parsed.data);
  return NextResponse.json({ property: created }, { status: 201 });
} catch (e) {
  return NextResponse.json({ error: (e as Error).message }, { status: 500 });
}
```

Use **422** for validation failures (not 400) so the client can distinguish
"your input" from "malformed request". Keep 401/403 from `guard()` unchanged.

**C. Client fetch must always recover.** Any `fetch` that drives a button state
must be wrapped so that on **any** outcome (network reject, non-OK, malformed
body) the UI resets and shows a plain message. No code path may leave a button
stuck.

**D. Plain language for non-technical users.** Error copy is for someone with
limited technical ability. Prefer "Add a title before saving." over "title:
Required". Prefer "We couldn't reach the server — check your internet and try
again." over surfacing a raw exception. Keep raw technical detail in the server
log / console, not the UI.

---

## 5 · RUNNING THE APP (every phase needs this)

```
# from contract-ivy-devs/
npm install                 # if node_modules missing
npm run dev                 # http://localhost:3001  (may already be running)
npx tsc --noEmit            # typecheck gate — must stay clean
```

**Dev logins** (password `password` for all): `owner@test.com` (Owner),
`assistant@test.com`, `gm@test.com`, `agent@test.com`. Owner is the most
permissive — use it for create tests.

Test data lands in `.devdata/properties.json` (gitignored). Smoke-test rows can
be removed by deleting them from that file or via the owner-only delete endpoint
— clean up after yourself so the dev list stays sane.

---

## 6 · TESTING TOOLKIT (shared across phases)

Each phase has its own **Testing Protocol**, but these are the available tools.
**You (the implementing chat) run all automated tests yourself.** Only hand
steps to the human when a test genuinely needs a human (e.g., a real iPhone
photo, or eyeballing a UI animation) — and then keep the steps short and plain.

### 6.1 Typecheck & pure-logic tests (always)
- `npx tsc --noEmit` — must be clean.
- `scripts/test-logic.ts` holds pure-function unit tests. Extend it with cases
  for any new pure logic (validators, parsers). Run with:
  `node --experimental-strip-types scripts/test-logic.ts`
  (🔎 INVESTIGATE the exact invocation if Node version differs; confirm it runs
  green *before* adding cases so you have a baseline.)

### 6.2 Authenticated API smoke tests (curl against the running dev server)
Log in once to capture a session cookie, then hit the real routes:

```
# 1. get a session cookie as Owner
curl -s -c /tmp/sansi.cookies -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@test.com","password":"password"}'

# 2. use it (example: empty create should now be rejected, not 201)
curl -s -b /tmp/sansi.cookies -X POST http://localhost:3001/api/properties \
  -H 'Content-Type: application/json' -d '{}' -w '\nHTTP %{http_code}\n'
```

Build per-phase assertions on top of this (valid payload → 201; bad lat → 422
with a `fields.latitude` message; etc.). Remember each successful create writes
a row — delete test rows afterward.

### 6.3 Supabase MCP (limited, read-only — see the caveat in §1)
- ✅ Allowed: `list_projects` (confirm no Sansi project exists yet),
  reading `database/schema.sql` in-repo and reasoning about prod-path parity.
- ❌ Forbidden: running SQL / inserting test data / creating branches against
  the **PLAYR** project. It is not ours.
- When validation references DB columns, sanity-check the field names against
  `database/schema.sql` (and the `toRow`/`fromRow` maps in
  `lib/repo/properties.ts`) so the prod path won't break when it's eventually
  provisioned. Note any mismatch in the ledger as a follow-up.
- **Deferred prod verification:** for anything that can only be truly verified
  against a live Supabase project, write the intended check into your ledger
  entry under "Deferred prod verification" so it can be run once the client
  provisions Supabase.

### 6.4 The client-hang test (C1) — how to actually prove it
To prove the form no longer hangs on a network failure, with the dev server
running and the form filled: stop the dev server (or use devtools "Offline")
and submit. The button must return to its normal state and show a friendly
message. (This one likely needs a quick human eyeball — give the steps in the
phase if so.)

---

## 7 · PROGRESS LEDGER (append one entry per phase — MANDATORY)

> The next chat reads this first. Be specific. If you deviated from the plan or
> found something new, say so here.

**Entry template (copy, fill, append):**

```
### Phase N — <NOT STARTED | IN PROGRESS | COMPLETE>
- Date: YYYY-MM-DD
- Commit(s): <hashes or "uncommitted; see git diff">
- Files changed: <path — one line why each>
- 🔎 INVESTIGATE items resolved: <question → decision → why>
- Deviations from plan / new findings: <...>
- Tests run + results: <tsc, logic tests, curl smoke, supabase checks — outcomes>
- Deferred prod verification (Supabase-blocked): <checks to run once provisioned>
- Known gaps / notes the next phase MUST know: <...>
```

### Phase 1 — COMPLETE
- Date: 2026-06-05
- Commit(s): uncommitted (not asked to commit) — see `git diff` + untracked
  `lib/apiError.ts`, `lib/validation/property.ts`. Code diff stat:
  `app/api/properties/route.ts`, `app/api/properties/[id]/route.ts`,
  `components/PropertyForm.tsx`, `scripts/test-logic.ts`.
- Files changed:
  - `lib/apiError.ts` (NEW) — `validationError(zodError)` maps zod issues →
    `{ error, fields }` 422. First issue = top-level `error`; one message per
    top-level field (first wins). The shared error envelope (§4A).
  - `lib/validation/property.ts` (NEW) — `CreatePropertySchema` /
    `UpdatePropertySchema` + inferred types. Single source of truth for shape +
    range validation (L3, M1-server).
  - `app/api/properties/route.ts` — POST now `safeParse`→422, validates
    `assignedAgentId` is a real active agent (L2), wraps `createProperty` in
    try/catch→500 with the real message (H1).
  - `app/api/properties/[id]/route.ts` — PATCH mirrors the same (validate →
    L2 → try/catch). Non-owner→pending reset left intact (still in
    `updateProperty`, driven by `user.role`).
  - `components/PropertyForm.tsx` — submit `fetch` wrapped in
    try/catch/finally with `Content-Type: application/json` (C1, L4); friendly
    offline message; create-only empty-title pre-check (C2 client half);
    `fieldErrors` state stashed for Phase 3; **+ `friendlyError(status, error)`
    helper** (added during verification — see Deviations) so a raw machine code
    is never shown to the user.
  - `scripts/test-logic.ts` — +12 schema cases (now 24 total, all green).
- 🔎 INVESTIGATE items resolved:
  - *Helper vs inline (1.1):* Built a tiny `lib/apiError.ts`. Two routes need
    the identical zod→fields mapping, so a 12-line shared helper beats
    duplicating the inline `users/route.ts` pattern twice. Kept minimal.
  - *Schema location (1.2):* `lib/validation/property.ts` (matches the doc's
    first suggestion; leaves room for sibling schemas later).
  - *Required-at-create set (1.2):* **`title` only.** It's the one
    human-meaningful identifier and blocks the "empty ghost" (C2) while still
    allowing genuine drafts — the heavy set is already enforced at publish by
    `lib/prepublish.ts`, so double-gating creation would block legitimate
    work-in-progress. Everything else is *validated only if present*.
  - *Ranges (1.2/M1):* bed/bath = non-negative **integers** (matches DB `INT`;
    note this rejects "2.5 baths" — deliberate, per plan's "integer" wording);
    price ∈ [0, 1e12 KES]; lat ∈ [-90,90]; lng ∈ [-180,180]; year ∈
    [1800, currentYear+1]; plot W/L ∈ [0, 100000 m]. `currentYear` read once at
    module load.
  - *Immutable strip (1.2):* referenceNumber/approval/id/status/createdAt are
    simply absent from the schema, so zod's default object behaviour strips them
    (proved by a logic-test case). `idempotencyKey` is intentionally **allowed**
    (the form legitimately sends it). Parity with `updateProperty`'s own strip.
  - *L2 agent source (1.3):* reused `listActiveAgents()` from
    `lib/repo/users.ts` — only validate when a non-agent supplies an id;
    agents are still force-assigned to self (unchanged).
- Deviations from plan / new findings:
  - **`photoDimensions` may contain `null`.** The form sends
    `dimsByUrl[u] || null` positionally per photo, and the *old untyped* route
    passed those nulls straight through to storage. The schema therefore accepts
    `({w,h}|null)[]`. But `PropertyRecord.photoDimensions` is typed `{w,h}[]`, so
    the now-typed `parsed.data` needed a documented `as Partial<PropertyRecord>`
    cast at both route boundaries. This is **parity, not new behaviour** — nulls
    already flowed through. Follow-up worth considering later: widen the record
    type to `({w,h}|null)[]` to make this honest (out of scope here; would ripple
    into brochure consumers).
  - Two message-quality fixes after the first curl pass: a *missing* `title`
    gave zod's bare "Required" (the `.min` only fires when present-but-blank), so
    `title` got `z.string({ message })`; and a non-object/malformed body gave
    "Expected object, received null", so both schemas got an object-level
    `{ message: "Please fill in the property form before saving." }`.
  - Note: the new `fieldErrors` getter is currently set-but-unread (Phase 3
    renders it). `tsc` is clean (`noUnusedLocals` is off); ESLint may warn on a
    future `next build` — harmless, and resolved the moment Phase 3 consumes it.
  - **`friendlyError()` hardening (found during C1 verification).** While
    proving C1 in-browser, the form briefly showed a raw `NOT_FOUND`. Root cause
    was **environmental, not our code** (see the env note in Known gaps), but it
    exposed a real §4C/§4D gap: the non-OK branch did `setError(j.error || …)`,
    so any response whose `error` is a machine code (a foreign 404's
    `NOT_FOUND`, the guard's bare `Unauthenticated`/`Forbidden`) would leak to a
    non-technical user. Added a tiny pure helper: surface `j.error` only when it
    reads like a sentence (has a space and isn't an ALL-CAPS_CODE) — which keeps
    H1's real backend messages flowing — else a status-based plain line (401/403
    → "session timed out", 404 → "couldn't reach the save service", else
    generic). Not unit-tested in `scripts/test-logic.ts` (it lives in a
    `"use client"` component; importing it would drag React/JSX into the node
    strip-types runner) — covered by the manual C1 check instead. If Phase 3
    wants it tested, lift it to a `lib/` module and add cases.
- Tests run + results:
  - `npx tsc --noEmit` → **exit 0** (clean, before and after).
  - `node --experimental-strip-types scripts/test-logic.ts` → **24/24 green**
    (12 pre-existing + 12 new schema cases: minimal-valid passes, empty fails on
    `title`, blank title fails, neg/non-int bedrooms fail, lat=999 fails w/
    `latitude` path, lat=-1.2 passes, absurd & future year fail, neg price fails,
    immutables stripped, nullable photo-dims accepted).
  - curl smoke (Owner cookie, dev server :3001): `{}`→422
    "Add a title before saving." w/ `fields.title`; `{latitude:999}`→422 w/
    `fields.latitude`; `{bedrooms:-2}`→422 w/ `fields.bedrooms`; malformed
    body→422 friendly (no crash); bogus `assignedAgentId`→422 w/
    `fields.assignedAgentId`; valid payload→**201**; real agent
    (`dev-agent`)→201; PATCH `{latitude:999}`→422, PATCH `{bedrooms:4}`→200.
    **All test rows deleted** — `.devdata/properties.json` back to 2 rows.
  - Supabase MCP `list_projects` → only **PLAYR** (`frkrlsqzaumdynuxqhrw`); **no
    Sansi project** (unchanged). No SQL run against PLAYR.
  - **C1 verified end-to-end in the browser (human, by the user).** On a clean
    single-server port (see env note), DevTools → Network → Offline → click
    *Create property* → the page showed *"We couldn't reach the server — check
    your internet connection and try again."*, the button returned to *Create
    property* (not stuck on "Saving"), and **no** row was created. Screenshot
    confirmed. C1 DoD met.
  - Parity: every validated field maps to a real `properties` column
    (`migrations/001_init.sql` + 002–009) via `toRow`. No mismatches. (Sansi has
    **no** consolidated `schema.sql` — the doc's §6.3 reference is Playr's;
    columns live in `migrations/`.)
- Deferred prod verification (Supabase-blocked): once a real Sansi Supabase is
  provisioned, re-run the curl matrix against `USE_DEV_DATA=false` to confirm:
  (a) the create try/catch surfaces the *real* Postgres message (e.g. a
  reference_number unique-collision or an FK violation on a bad
  `assigned_agent_id`) rather than the generic line; (b) `photo_dimensions`
  JSONB round-trips arrays containing `null`; (c) the `property_type` / `tenure`
  / `facing_direction` CHECK constraints agree with the schema enums.
- Known gaps / notes the next phase MUST know:
  - **Error envelope is live:** routes now return `{ error, fields }` (422 for
    validation, 500 for backend). Phase 3 should consume `fieldErrors` (already
    populated in `PropertyForm` state) to render inline; field keys === input
    `name`s. The top-level red line at `~PropertyForm` bottom still shows
    `error` (Phase 3 replaces with located inline UX + scroll-to-error).
  - The client empty-guard is **create-only** and checks **`title` only** — keep
    it in sync with the server's required set if that set ever grows.
  - C1 offline-hang proof: structurally guaranteed (finally resets unless
    `navigatedAway`), but the live "go Offline → submit → button recovers"
    eyeball was handed to the human (see below) — not yet confirmed by a person.
  - Phase 2 (uploads) is mostly independent; it should not need to touch the
    submit fetch except the H3 `disabled` condition — don't regress the C1
    try/catch/finally when you do.
  - **⚠️ ENV — port 3001 clash (bit us during testing).** The sibling **PLAYR**
    backend (`playr-backend-curs/src/index.ts`, a Fastify/tsx server) also
    listens on **:3001**. When both run, `localhost:3001` resolves to IPv4 vs
    IPv6 non-deterministically, so browser fetches sometimes hit PLAYR (→ a
    foreign 404 / `NOT_FOUND` body) instead of Sansi, and DevTools Offline can
    appear not to apply. **Before any browser/curl testing, run
    `lsof -nP -iTCP:3001 -sTCP:LISTEN` and make sure ONLY the Sansi Next server
    is there.** If PLAYR is squatting, stop it (or run Sansi on another port).
    This is purely a local-dev collision — production deploys won't share a port.

### Phase 2 — COMPLETE
- Date: 2026-06-05
- Commit(s): uncommitted (not asked to commit) — see `git diff` + new files.
  Code touched: `app/api/upload/route.ts`, `components/PropertyForm.tsx`,
  `lib/storage.ts`, `scripts/test-logic.ts`; NEW `lib/imageMime.ts`;
  `package.json`/`package-lock.json` (added `heic-convert` + `@types/heic-convert`).
- Files changed:
  - `lib/imageMime.ts` (NEW) — single source of truth for the image MIME→ext
    map, the 10 MB cap (`PHOTO_MAX_BYTES`), and the **pure** `precheckImageFile()`
    client pre-check (L6). Dependency-free so it's importable by the "use client"
    form, the server route, and the node strip-types test runner alike.
  - `lib/storage.ts` — now imports `IMAGE_MIME_EXTS` + `PHOTO_MAX_BYTES` from
    `lib/imageMime.ts` and **re-exports** `PHOTO_MAX_BYTES` so existing importers
    of `@/lib/storage` (documents route) are unchanged. `isAllowedImage`,
    `isAllowedDocument`, `DOCUMENT_MAX_BYTES`, `put`, etc. all preserved. Added
    `image/heif` to the map (parity with heic).
  - `app/api/upload/route.ts` — **HEIC transcode (H4)**: detect HEIC via declared
    MIME/extension *and* an `ftyp`-brand magic-byte sniff (so an empty-MIME,
    no-extension iPhone upload is still caught), decode HEIC→JPEG with
    `heic-convert`, capture dims via `sharp` on the resulting JPEG, store as
    `image/jpeg`. Non-HEIC path uses `sharp().rotate().metadata()` and now
    persists under the **decoded** format's MIME (honest extension even when the
    browser's declared type was empty/wrong). Undecodable HEIC → friendly 422
    (never store an unviewable, dimensionless file). MIME gate loosened **only**
    for the missing/octet-stream-type-with-image-extension case; explicit
    non-image MIME still 415. Uses the shared `PHOTO_MAX_BYTES`. Friendlier
    413/400/415 copy (§4D).
  - `components/PropertyForm.tsx` —
    - `uploadFiles` rewritten: client pre-check (L6) → **settle-all** (H2; was
      `Promise.all`), so a bad file never discards the good ones; failures are
      collected and reported **by filename** in plain language. Counter (L5) is
      now **per-file inc/dec** (`n+1` on start, `Math.max(0, n-1)` in `finally`)
      instead of `+len`/reset-to-0, so overlapping batches stay accurate and it
      can't go stale/negative.
    - `uploadFloorPlans` given the same settle-all + pre-check treatment; keeps
      the 3-image cap and "only the first N added" messaging, now merged with any
      per-file failures.
    - **H3:** submit button `disabled={saving || uploading > 0 || uploadingFloorPlan}`
      + a "Photos still uploading…" hint, and an `onSubmit` early-return guard
      (defends against a stray Enter). C1's try/catch/finally fetch left untouched.
    - Floor-plan dropzone hint now lists HEIC (accuracy, L6).
  - `scripts/test-logic.ts` — +7 `precheckImageFile` cases (now **31** total,
    all green): normal JPG, oversize, explicit non-image, HEIC w/ explicit MIME,
    HEIC w/ empty MIME via extension (iPhone), empty-MIME + non-image ext, and
    octet-stream + image ext.
- 🔎 INVESTIGATE items resolved:
  - **Counter model (2.1/L5):** per-file increment on start / decrement in
    `finally`, never reset to a literal. Two concurrent batches each contribute
    their own +1/-1 so the displayed "Uploading N…" is always the true in-flight
    count and reaches exactly 0.
  - **HEIC deep-dive (2.4) — THE key finding, deviates from the plan.** The plan's
    *preferred* path was "transcode HEIC→JPEG with `sharp` if it supports HEIC."
    **It does not.** Probed with a real 4032×3024 iPhone HEIC (from the Xcode iOS
    simulator's `IMG_0006.HEIC`): `sharp` reads the HEIF *container* metadata
    (`format: heif`, dims present) but **pixel decode fails** —
    `heif: Error while loading plugin: Support for this compression format has not
    been built in`. The prebuilt `@img/sharp-libvips-darwin-arm64` (libvips 8.17.3)
    has **no HEVC codec** (HEVC is patent-encumbered and stripped from sharp's
    prebuilt binaries — the same is true of the Linux prebuilt, so prod won't
    differ). HEIC *encode* fails too (`heifsave: Unsupported compression`). NB:
    the dylib *does* contain `Decoder_HEVC`/`heifload` symbols and prints
    "HEIC/AVIF load/save with libheif: true" — those strings are **misleading**;
    only the runtime decode probe is authoritative.
    - Also flagged a hidden flaw in the plan's *fallback* (store HEIC + show a
      placeholder): the brochure renderer is Chromium/puppeteer, which **also**
      can't display HEIC — a stored HEIC would break the website and the generated
      brochure, not just the form thumbnail. So "store + placeholder" is a
      downstream dead-end.
    - **Decision (confirmed with the user):** add the `heic-convert` package (a
      pure-JS libheif/libde265 decoder) and transcode HEIC→JPEG **server-side at
      upload**. This fulfils the plan's *intent* (transcode once at upload, not
      per render) using a decoder that actually works here. Phone photos now "just
      work" everywhere; dims are always captured so the landscape-cover guard is
      reliable for HEIC. Proven: ~1.3 s to decode the 12 MP sample.
  - **Cover-guard bypass (H4b):** resolved by the above — every *new* upload that
    succeeds now carries dims (HEIC included), and an **undecodable** HEIC is
    rejected (422), never stored dimensionless. I deliberately did **not** also
    disable ★/primary for *legacy* unknown-dimension photos: the form intentionally
    allows unknown (older rows; there's a separate client `Image().naturalWidth`
    backfill per HANDOFF §6.2), and the brochure already has a forest-green
    landscape-cover fallback (deliverables #132). Tightening that would regress
    legitimate editing of old listings for no real safety gain.
  - **Shared allowlist location:** moved the MIME map to `lib/imageMime.ts` (vs.
    duplicating storage's allowlist on the client) — the plan's efficiency note
    wants one source of truth for client+server limits.
- Deviations from plan / new findings:
  - Added a runtime dependency: **`heic-convert`** (+`@types/heic-convert`). See
    the HEIC decision above for why sharp couldn't be used.
  - `npm audit` reports **2 moderate** issues — both are **pre-existing**
    (`postcss` reached via `next`), **not** introduced by `heic-convert`; the only
    "fix" is a breaking downgrade to `next@9`, so left alone.
  - Upload route now derives the *stored* MIME from sharp's decoded `format`
    (non-HEIC) so the on-disk extension is honest regardless of the browser's
    declared type — a small honesty improvement over passing `file.type` straight
    to `put()`.
- Tests run + results:
  - `npx tsc --noEmit` → **exit 0** (clean).
  - `node --experimental-strip-types scripts/test-logic.ts` → **31/31 green**
    (24 prior + 7 new pre-check cases).
  - **sharp HEIC probe** (throwaway script, removed): metadata OK but pixel
    decode/transcode **FAILS** (HEVC not built in). **heic-convert probe** on the
    same real HEIC: decodes → JPEG 4032×3024 in ~1.3 s. ✅
  - **curl upload matrix** (Owner cookie, dev server :3001, only-Sansi-on-3001
    confirmed via `lsof`): valid portrait JPG → **200** `{url:.jpg, 800×1200}`;
    11 MB file → **413**; non-image `.txt` → **415**; real iPhone HEIC
    (`image/heic`) → **200** with a **`.jpg`** url + dims **4032×3024** (transcoded!);
    HEIC as `application/octet-stream` + `.HEIC` name → **200** `.jpg` (iPhone
    no-MIME case handled); explicit `application/pdf` with `evil.jpg` name → **415**
    (extension loophole closed). Stored outputs verified valid JPEGs via
    `sharp().metadata()`. **All test files deleted** (`public/uploads` is
    gitignored; `.devdata` untouched at 2 rows — upload writes no property rows).
  - H2 partial-success + H3 submit-block are client-state behaviours: structurally
    guaranteed (per-file try/catch returning null + `filter`; button disabled on
    `uploading>0||uploadingFloorPlan` + onSubmit guard) and corroborated by the
    curl matrix proving each file independently returns its own status. The live
    multi-file DOM feel is the one optional human eyeball (steps below) — not
    required to prove correctness.
- Deferred prod verification (Supabase-blocked): once a real Sansi Supabase is
  provisioned and `USE_DEV_DATA=false`: (a) confirm `put()` uploads the
  **transcoded JPEG** (not the HEIC) to the `property-photos` bucket with
  `contentType: image/jpeg` and a public URL that renders; (b) confirm
  `heic-convert` runs in the prod Node runtime (it's pure-JS WASM, no native
  binary, so it should — but verify memory/time on a 12 MP photo under the
  serverless limits); (c) re-confirm the prod Linux `sharp` build likewise lacks
  HEVC decode (expected) so the heic-convert path stays necessary.
- Known gaps / notes the next phase MUST know:
  - **HEIC is now always stored as JPEG.** Any code downstream that assumed a
    `.heic` could be stored can drop that assumption — uploaded assets are always
    web-displayable (jpg/png/webp/gif).
  - **`uploading` is now a live in-flight count** (per-file inc/dec), not a
    batch-size snapshot. Phase 3 should keep using `uploading > 0` /
    `uploadingFloorPlan` for any "busy" UI; don't reset the counter to a literal.
  - **`lib/imageMime.ts` is the shared limit source.** Phase 3's client-side
    range/format checks should import from it, not re-hardcode 10 MB or the MIME
    list.
  - Phase 1's submit `fetch` (C1 try/catch/finally) and the empty-title guard were
    left intact; H3's guard was *added before* payload assembly and resets
    `saving`/`submitting` exactly like the title guard, so C1 is not regressed.
  - `friendlyError()` and the `fieldErrors` state from Phase 1 are still
    set-but-mostly-unread, awaiting Phase 3's inline display — unchanged here.
  - ENV note from Phase 1 still applies: before browser/curl testing run
    `lsof -nP -iTCP:3001 -sTCP:LISTEN` to be sure PLAYR isn't squatting :3001. It
    was clear this session.

### Phase 3 — COMPLETE
- Date: 2026-06-05
- Commit(s): uncommitted (not asked to commit) — see `git diff` + new files.
  Code touched: `components/PropertyForm.tsx`; NEW `lib/coordinates.ts`,
  `app/error.tsx`, `app/global-error.tsx`; `scripts/test-logic.ts` (+11 cases).
- Files changed:
  - `lib/coordinates.ts` (NEW) — pure, dependency-free `parseCoordinatePair()`
    for M2. Returns `{lat,lng}` for an in-range pair, `{error}` for a
    recognisable-but-out-of-range pair, or `null` when the text isn't a pair
    (so the caller leaves a single-number paste alone). Bounds match
    `lib/validation/property.ts` ([-90,90]/[-180,180]). Importable by the
    "use client" form and the strip-types test runner alike.
  - `app/error.tsx` (NEW, M3) — route-level App-Router error boundary. Renders
    *inside* the root layout, so Tailwind/globals apply; plain copy
    ("This page hit a problem"), **Try again** (`reset()`) + **Go to
    properties**. Raw error → `console.error` only, never the UI (§4D).
  - `app/global-error.tsx` (NEW, M3) — top-level boundary for a throw in the
    root layout itself (the one place `app/error.tsx` can't reach). Supplies its
    own `<html>/<body>` and is **inline-styled** with the brand tokens, since it
    replaces the layout that imports globals.css (Tailwind would not load).
  - `components/PropertyForm.tsx` — the bulk of Phase 3:
    - **3.1 / C2 / M1 / M5 inline located errors + scroll.** Added a tiny
      `FieldError` subcomponent (reads `fieldErrors[name]`, renders a plain red
      line under the input) placed under every validated field (title, country,
      city, propertyType, assignedAgentId, price, bed/bath, year built/restored,
      facingDirection, plot W/L, latitude, longitude, tenure). `onSubmit` now
      runs the **same zod schema the routes use** (`Create/UpdatePropertySchema`)
      against the assembled payload *before* the round-trip — bad input shows
      inline instantly (no server hop) via a new client `zodToFieldErrors()`
      mapper (mirrors `lib/apiError.ts`, which can't be imported client-side —
      it pulls in `next/server`). On a client *or* server (422) validation
      failure, `scrollToFirstError()` smooth-scrolls to + focuses the first
      erroring control in DOM order. Top-level `error` line doubles as the
      summary ("Please fix the highlighted fields below…").
    - **M2 coordinate paste.** `onPaste` on both lat/lng inputs runs
      `parseCoordinatePair`; a recognised pair fills *both* (uncontrolled inputs,
      set via `formRef` `.value`), clears prior coord errors, marks dirty;
      out-of-range shows a `fields.latitude` message; a single value falls
      through to the native paste. Tip copy updated to mention paste-both.
    - **M3** — see the two new boundary files above.
    - **M4 Enter guard.** Form-level `onKeyDown` preventDefaults Enter from
      single-line `<input>`s. Allows textarea newlines (tag check), the explicit
      submit/any `<button>` (tag check), and ChipInput's Enter-to-add (its own
      handler runs first on bubble + adds the chip, the form handler only
      re-preventDefaults — verified the chip still adds).
    - **M5** — `scrollToFirstError` (see 3.1).
    - **M6 unsaved-changes guard.** A `dirty` flag: set by form-level
      `onInput`+`onChange` (covers every native control: text/number/select/
      checkbox/textarea — incl. the agent select & nearby rows via bubbling) and
      by explicit `markDirty()` calls in the React-managed mutators that emit no
      DOM event (photo upload/remove/reorder/setPrimary, floor-plan add/remove,
      caption set incl. AI, AI description, highlight/amenity chip changes, nearby
      add/remove, coord paste). While dirty: a `beforeunload` handler (tab
      close/refresh/external nav) **and** a capture-phase document click listener
      that intercepts in-app `<a>` navigation (Header back/profile links) with a
      "Leave without saving?" confirm — App Router has no built-in nav guard.
      Cleared on a successful save (`setDirty(false)` before `router.push`) so
      the post-save redirect never prompts; never armed on a clean form.
    - **L1 agent-list failure.** The agents `useEffect` is refactored into a
      `loadAgents` callback with `agentsError`/`agentsLoading`; on failure the
      dropdown shows an inline "Couldn't load the agent list. **Retry**" notice
      (replacing the silent empty dropdown), retry re-runs `loadAgents`.
    - Added `name="assignedAgentId"` to the agent `<select>` (it had none) so
      scroll-to-error + the FieldError map work uniformly by input name.
  - `scripts/test-logic.ts` — +11 `parseCoordinatePair` cases (now **42** total,
    all green): comma+space / comma-only / whitespace pairs, trimming, single
    number → null, three values → null, non-numeric → null, empty → null,
    out-of-range lat/lng → error, boundary (-90,180) accepted.
- 🔎 INVESTIGATE items resolved:
  - **3.1 lightest fields→input mapping:** a `FieldError({name})` subcomponent
    reading a `fieldErrors` record keyed by input `name`, sprinkled under each
    input — no form library, no refs-per-field. Scroll uses one
    `querySelectorAll("[name]")` walk in DOM order. The decisive efficiency win
    was reusing Phase 1's **single zod schema** client-side (the plan's stated
    goal): client and server now validate the *identical* payload with the
    *identical* rules and messages, so inline display is wired once, not twice.
  - **3.2 paste mechanism:** chose smart `onPaste` on the existing two fields
    (not a separate "paste coordinates" field) — zero new UI, works whether the
    user pastes into lat or lng, and degrades to normal paste for a lone number.
    Pure parser lives in `lib/coordinates.ts` so it's unit-tested.
  - **3.3 Next 15 conventions:** `app/error.tsx` (client, inside layout, Tailwind
    OK) + `app/global-error.tsx` (own html/body, inline-styled because it
    bypasses the globals.css-importing layout). One `app/error.tsx` at the root
    covers all of `app/properties/*` (the plan's "at least properties"), so no
    per-segment file was needed. Verified a throw is caught (see Tests).
  - **3.5 mechanism:** `beforeunload` + capture-phase anchor-click confirm. App
    Router (Next 15) exposes no navigation-guard API, so intercepting `<a>`
    clicks at the document level (capture, `stopPropagation` on cancel) is the
    pragmatic way to catch in-app Link navigation; `beforeunload` handles the
    hard-nav cases. Both armed only while dirty → not annoying on a clean form.
  - **Dirty-tracking model (M6):** chose **explicit `markDirty()` in mutators +
    form-level onInput/onChange**, *rejecting* a `useEffect`-watches-collections
    approach because **`reactStrictMode: true`** (confirmed in `next.config.js`)
    double-invokes mount effects in dev, which would trip a mount-guard ref and
    falsely flag a pristine form dirty. The explicit model is StrictMode-safe and
    more precise.
- Deviations from plan / new findings:
  - **Replaced** Phase 1's create-only empty-title pre-check with full client
    zod validation (it subsumes the title check and adds every range/type rule).
    Behaviour is a strict superset — empty title still blocks create, now with
    the same inline treatment as every other field.
  - No new runtime dependencies. `zod` was already present (Phase 1).
  - **Project has no ESLint config** (running `next lint` prompts to set one up).
    Consistent with Phase 1's note that `tsc` is the real gate. `next build`
    does not lint without a config, so the build is clean. Did **not** add an
    ESLint setup (out of scope).
  - `friendlyError()` and the Phase-1 `fieldErrors` state are now **fully
    consumed** (they were "set-but-unread" through Phase 2) — the dangling-getter
    note from Phases 1–2 is resolved.
- Tests run + results:
  - `npx tsc --noEmit` → **exit 0** (clean). NB: a production `next build` writes
    `.next/types/*` that briefly referenced a temp throw-test route; clearing
    `.next` (gitignored) restored a clean `tsc`. Final `tsc` is clean.
  - `node --experimental-strip-types scripts/test-logic.ts` → **42/42 green**
    (31 prior + 11 new coordinate-parser cases).
  - `npx next build` → **Compiled successfully, 24/24 pages generated** (only the
    pre-existing multi-lockfile workspace-root warning; nothing from Phase 3).
    Confirms `app/error.tsx`, `app/global-error.tsx`, and the form all compile
    for production.
  - **curl smoke** (Owner cookie, dev :3001, `lsof` confirmed Sansi-only on 3001):
    empty `{}`→422 `fields.title`; `{title:"X",latitude:999}`→422 `fields.latitude`
    — the envelope the new inline UI consumes is intact. `GET /properties/new`→200
    (40 KB, form + paste hint present) — the rewritten form compiles & renders.
  - **Error-boundary proof (M3):** added a temporary `force-dynamic` route that
    throws, in **both** dev and a real `next build && next start`:
    - dev → 500, Next's dev overlay (dev-only; shows the error to the developer).
    - **production → 500 with the throw caught by the boundary; the raw message
      ("intentional throw") is NOT in the served HTML — only in the server log
      with a `digest`.** This proves §4D: a server-component crash never leaks a
      stack to the user. The *visible* friendly text renders client-side after
      hydration (error.tsx is a client boundary), so curl/no-JS can't see the
      copy — that final visual is the one human eyeball below. Temp route removed.
  - `.devdata/properties.json` untouched (no test rows created — all validation
    failures 422'd before any write; no valid create was submitted this phase).
- Deferred prod verification (Supabase-blocked): none new specific to Phase 3 —
  it's all client UX + the routes were unchanged. The Phase 1/2 deferred items
  still stand. (When Supabase is live, a real 422 from the create route should
  still render inline via the same `fields` path — no client change needed.)
- Known gaps / notes the next phase MUST know:
  - **All §3 boxes are now ticked; the plan's §9 "DONE" criteria are met** modulo
    the visual eyebrows below. Phase 3 was the last phase.
  - **Three short human eyeball checks remain** (UI feel only — all logic is
    proven above). See the message handed to the user; in brief: (1) blank-form
    submit → inline messages + scroll-to-first; (2) paste "-1.2163, 36.7928" into
    a coordinate box → both fill; (3) edit then try to close the tab → "leave
    without saving?" warning, and confirm a successful save does **not** warn.
    Plus, optionally, force a server-component throw in the browser to see the
    styled `app/error.tsx` (it renders client-side, so only a browser shows it).
  - **Client/server validation now share one schema.** If a future change adds a
    field or tightens a range in `lib/validation/property.ts`, the form's inline
    UX picks it up automatically — but add a matching `FieldError name="…"` under
    the new input (otherwise its error only shows in the top summary line).
  - The M4 Enter guard means **Enter no longer submits the form** from a text
    input by design — users click the explicit button. ChipInput Enter-to-add
    and textarea newlines are preserved.
  - The unsaved-guard's in-app interception keys on `<a href>` clicks; a future
    programmatic `router.push` from a button would bypass it (as the post-save
    redirect intentionally does). Not a regression — just don't rely on it for
    button-driven nav.

### Phase 3 follow-up — Expanded required-set on create — COMPLETE
- Date: 2026-06-05
- Why: user decision — the add-property form should require **every** field
  except the ones the UI marks "(optional)", not just `title`. This **overrides**
  Phase 1's "title only at create" choice (which kept create light for drafts).
  Chosen policy (confirmed with the user): **literal — require all unlabelled
  fields regardless of property type**, **applied to CREATE only** (edit stays
  lenient), **with visible label cues**.
- Files changed:
  - `lib/validation/property.ts` — split into a lenient `baseFields` set (now used
    by `UpdatePropertySchema` — every field optional, for partial PATCH edits) and
    a strict `createRequired` overlay merged into `CreatePropertySchema`. Required
    on create: title, country, city, propertyType, price (>0), bedrooms,
    bathrooms, yearBuilt, plotSize, builtArea, facingDirection, plotWidthMeters
    (>0), plotLengthMeters (>0), description, highlights/amenities/nearby/photos
    (≥1), latitude, longitude, tenure, shape, siteCondition, saleTerms,
    topography, boundary, services. **Stay optional:** yearRestored,
    restorationNotes (the two "(optional)"-labelled fields), floor plan, captions/
    dimensions, brochure toggles, and `assignedAgentId` (see below). Counts
    (bed/bath) allow 0; money/measurements use `.positive()`. All messages are
    plain language (§4D).
  - `app/api/properties/route.ts` — the "an agent must be assigned" rule is
    enforced **here for non-agent creators** (missing → 422 `fields.assignedAgentId`)
    rather than in the shared schema, because agents are force-assigned to
    themselves server-side and never send the field — putting it in the schema
    would break agent creates. Folded the missing-agent check in with the existing
    L2 active-agent check.
  - `components/PropertyForm.tsx` — (a) client validation now uses the strict
    `CreatePropertySchema` on create and adds the same non-agent agent check
    before the round-trip; (b) a red `*` cue (`reqMark`) on every required label,
    shown **only on create** (edit is lenient, so no cue), plus a top-of-form note
    "All fields are required unless marked (optional)"; (c) the state-driven
    sections (photos, highlights, amenities, nearby) gained `data-field` anchors +
    `FieldError`s so they render inline and `scrollToFirstError` can reach them
    (it now matches `[name], [data-field]`); (d) the floor plan label gained an
    explicit "(optional)" tag for consistency with the rule.
  - `scripts/test-logic.ts` — rewrote the create-schema cases around a complete
    `validCreate` fixture (every required field loops to prove it individually
    blocks + reports its own field), added price>0 / plot>0 / empty-array /
    0-bed-allowed / assignedAgentId-not-in-schema cases, and added a lenient
    `UpdatePropertySchema` block. Now **51** checks, all green.
- 🔎 Decisions / edge calls:
  - **Type-aware vs literal:** user picked literal (all types). So bedrooms/
    bathrooms/builtArea are required even for land, and plotSize/plot dims even
    for an apartment. This is intentional per the user; the publish checklist
    (`lib/prepublish.ts`) keeps its own (type-aware) gate on top.
  - **assignedAgentId** can't be a schema-required field (agents force-assigned);
    enforced in route + client for non-agents only (matches `showAgentPicker`).
  - **Floor plan** stays optional — its helper literally says "Optional"; marking
    it required would contradict the UI. Now also tagged "(optional)" in the label.
  - Missing arrays: added a `{ message }` param so a raw `{}` API body yields
    "Add at least one highlight." instead of zod's bare "Required" (the form
    always sends `[]`, which already hit the friendly `.min(1)` message).
- Tests run + results:
  - `npx tsc --noEmit` → **clean**. `test-logic.ts` → **51/51 green**.
  - `npx next build` → **Compiled successfully, 24/24 pages**.
  - curl matrix (Owner, dev :3001): `{}`→422 with the full plain-language field
    map; `{title}`-only→422 (no longer 201); a **complete** payload **without**
    agent→422 `fields.assignedAgentId` "Assign an agent before saving."; complete
    **with** `dev-agent`→**201**; complete with a bogus agent→422; single-field
    PATCH `{city}`→**200** (edit still lenient); PATCH `{latitude:999}`→422.
    The 201 test row was **deleted** (`.devdata` back to 2 rows). NB: the lenient
    PATCH smoke set row[0] (titled "Test") `city` to "Nairobi" — harmless on a
    throwaway smoke row, left as-is.
- Known gaps / notes:
  - **This is a deliberately heavy create gate.** Drafts with missing fields can
    no longer be created via the form/API (by design). If a lighter "save draft"
    path is ever wanted, it'd need its own schema/route — out of scope here.
  - Deferred prod verification (Supabase-blocked): when live, re-run the create
    matrix against `USE_DEV_DATA=false` to confirm the strict 422s and the 201
    persist identically through the Supabase repo path.

---

# PHASE 1 — Server Contract & Submit Reliability

**Theme:** Stop the bleeding. Make it impossible to (a) hang the UI, or (b)
store junk. This phase establishes the shared **error envelope** and the shared
**zod schema** that Phases 2–3 build on, so it must go first.

**Closes:** C1, C2 (server gate), H1, L2, L3, L4.

**Depends on:** nothing. This is the foundation.

### Pre-flight reading
- `components/PropertyForm.tsx` (focus: `onSubmit`, the payload assembly).
- `app/api/properties/route.ts` and `app/api/properties/[id]/route.ts` (PATCH).
- `lib/repo/properties.ts` (`createProperty`, `updateProperty`, `toRow`, types).
- `app/api/users/route.ts` (the zod pattern to copy).
- `lib/prepublish.ts` + `deliverables.md` #52–62 (so you don't double-gate).
- `app/api/agents/route.ts` + wherever agents are sourced (for L2).

### Tasks

**1.1 — Define the shared error envelope + (optional) a small helper.**
Establish the `{ error, fields? }` shape (§4A). 🔎 INVESTIGATE whether a tiny
shared helper (e.g. `lib/apiError.ts` to map zod issues → `fields`) is worth it
or if inline mapping matches the codebase style better. Keep it minimal.

**1.2 — Author the properties zod schema(s).**
Create a schema (suggest `lib/validation/property.ts` or colocated — 🔎 decide)
for the **create** payload, and a permissive variant for **update**. Requirements:
- **Required-at-create set:** 🔎 INVESTIGATE and decide the *minimum* truly
  required to create a (draft) property. The pre-publish checklist already
  enforces the heavy set at publish time — creation should stay light so drafts
  are allowed, but must block the "totally empty ghost" (C2). Justify the chosen
  set in the ledger.
- **Types + coercion:** numbers are numbers, arrays are arrays, enums match
  (`propertyType`, `tenure`, `facingDirection`, etc. — pull from
  `lib/repo/properties.ts`).
- **Range/sanity (M1, server side):** non-negative integer bed/bath; price ≥ 0
  (and a sane upper bound — 🔎 pick); `latitude` ∈ [-90, 90]; `longitude` ∈
  [-180, 180]; `yearBuilt`/`yearRestored` within a sane window (🔎 e.g.
  1800…currentYear+1). Coordinates and most fields stay **optional** — only
  *validated if present*.
- **Strip immutables:** ensure the schema/route never lets `referenceNumber`,
  `approval`, `id` through (the repo already strips on update — keep parity).
- Field keys in the `fields` map must equal the form input `name`s.

**1.3 — Wire schema + try/catch into the routes (H1, L2, L3).**
- POST `/api/properties`: `safeParse` → 422 `{error, fields}` on failure; wrap
  the `createProperty` call in try/catch → 500 `{error}` with the real message
  (so "couldn't allocate a unique reference number", DB/FS errors, etc. surface
  instead of the generic line).
- Mirror into PATCH `/api/properties/[id]` for consistency (🔎 confirm the
  update route's current shape and keep the non-owner→pending reset intact).
- **L2:** validate `assignedAgentId` (when provided by a non-agent) refers to a
  real, **active** agent. 🔎 INVESTIGATE the agent source to do this cheaply;
  reject with a clear `fields.assignedAgentId` message if invalid. Keep the
  existing rule that agents are force-assigned to themselves.

**1.4 — Harden the form submit (C1, L4).**
- Wrap the submit `fetch` so **every** outcome resets `saving` + `submitting`
  (use try/catch/finally). On network reject show a connection-friendly message
  (§4D). On non-OK, show `j.error`. Never leave the button stuck.
- Add the missing `Content-Type: application/json` header (L4).
- Surface the server response minimally for now (top-level `error` near the
  submit button is fine; **full inline `fields` UX is Phase 3** — but you may
  stash the returned `fields` in state so Phase 3 can render it).

**1.5 — Minimal client guard for empty submit (C2, client half).**
A light pre-submit check that blocks an obviously-empty form with a plain
message, so users get instant feedback without a round-trip. Keep it minimal —
the **server (1.2/1.3) is the real gate**; the pretty inline version is Phase 3.

### Testing Protocol — Phase 1
**You run these:**
1. `npx tsc --noEmit` clean.
2. Add pure-logic cases to `scripts/test-logic.ts` for the schema: valid
   minimal payload passes; empty payload fails; negative bedrooms fails; lat=999
   fails; lat=-1.2 passes; absurd year fails. Run it green.
3. curl smoke (§6.2) with the dev server: empty `{}` → **422** with a helpful
   `error`; a valid payload → **201**; `{"latitude":999}` → 422 with
   `fields.latitude`; malformed JSON body → handled, not a crash. Delete any
   created test rows.
4. Supabase MCP (§6.3): `list_projects` to reconfirm no Sansi project; check the
   validated field names against `database/schema.sql` + `toRow`. Record parity.
**Hand to the human only if needed:** the C1 hang check (§6.4) — give 3 short
steps (fill form → go Offline in devtools → submit → confirm a friendly message
appears and the button is usable again).

### Definition of Done — Phase 1
- Empty/garbage payloads cannot create a property (server-enforced).
- Backend errors reach the user as readable text, not "Could not save."
- The submit button can never get stuck; offline submit recovers gracefully.
- `tsc` clean; logic tests green; curl smoke matches expectations.
- Ledger entry written; §3 boxes ticked.

---

# PHASE 2 — Upload & Media Robustness

**Theme:** Make photo/floor-plan uploading forgiving and honest. No silent loss,
no broken thumbnails, no surprise.

**Closes:** H2, H3, H4, L5, L6.

**Depends on:** Phase 1 COMPLETE (reuse its error envelope; don't re-open the
submit logic except where noted). Mostly independent of Phase 1's schema.

### Pre-flight reading
- `components/PropertyForm.tsx` — `uploadFiles`, `uploadFloorPlans`,
  `removePhoto`, the photo grid (`<img>` previews, orientation badge, ★ guard),
  the submit button's `disabled` condition.
- `app/api/upload/route.ts` — size/MIME checks, the `sharp` dimension read.
- `lib/storage.ts` — `put`, `isAllowedImage`, the MIME→ext map.

### Tasks

**2.1 — Partial-success batch upload (H2, L5).**
Switch `uploadFiles` (and `uploadFloorPlans`) from `Promise.all` to a
settle-all approach: attach every file that succeeded, and report only the
failures, **by filename**, in plain language. Fix the `uploading` counter so it
stays accurate under concurrent batches and never shows a stale/negative count
(L5). 🔎 INVESTIGATE the cleanest counter model (e.g. track in-flight count by
increment/decrement per file rather than a single reset-to-0).

**2.2 — Block submit while uploads are in flight (H3).**
Disable the submit button (and show a short hint like "Photos still
uploading…") whenever `uploading > 0` or `uploadingFloorPlan`. Ensure it
re-enables correctly on success *and* failure. Coordinate with Phase 1's submit
logic — don't regress C1.

**2.3 — Client-side pre-check (L6).**
Before uploading, check each file's size and type on the client and reject with
instant, plain feedback (mirror the server's limits: 10 MB, the image MIME
allowlist in `lib/storage.ts`). The server remains the real gate — this is just
fast feedback. Keep the accepted-formats hint accurate.

**2.4 — HEIC handling (H4) — the deep dive. 🔎 INVESTIGATE.**
HEIC is the iPhone default and the founder shoots on her phone. Two failure
modes today: (a) browsers can't render HEIC in `<img>`, so previews look broken;
(b) if `sharp` can't read HEIC here, dimensions are missing → the landscape
cover guard can be bypassed.
- First, **probe** whether `sharp` in this environment can decode HEIC (write a
  tiny throwaway script that runs a HEIC buffer through `sharp().metadata()`;
  libheif may or may not be compiled in). Record the result.
- Then **decide and implement** the strategy:
  - *Preferred if sharp supports it:* transcode HEIC → JPEG **server-side at
    upload** so the stored asset is web-displayable, dimensions are captured,
    and the cover guard is reliable. (One conversion at upload beats per-render
    work — keep it efficient.)
  - *Fallback if not supported:* render a clear placeholder + plain warning for
    HEIC thumbnails, and make sure an **unknown-dimension** photo cannot
    silently become a landscape cover (tighten the guard or warn).
- Update `app/api/upload/route.ts`, `lib/storage.ts`, and the form preview as
  the chosen strategy requires. Keep the existing size/MIME/early-content-length
  protections intact.

### Testing Protocol — Phase 2
**You run these:**
1. `npx tsc --noEmit` clean.
2. The sharp-HEIC probe script — record pass/fail in the ledger.
3. curl upload tests (§6.2 cookie, then POST multipart to `/api/upload`):
   a valid JPG → 200 with `url` + `width`/`height`; an oversize file → 413; a
   non-image → 415; a HEIC → behaves per your chosen strategy (JPEG url + dims,
   or graceful path). 🔎 You may need to **generate test fixtures** — a tiny
   JPG/PNG via `sharp`, an >10 MB file via truncate/dd, and (if possible) a HEIC
   sample. If a real HEIC can't be synthesized, note it and fall back to the
   human step below.
4. Confirm via a quick UI pass or DOM check that successes attach when one file
   in a batch fails, and the submit button disables during upload.
**Hand to the human only if needed:** if no HEIC fixture is obtainable, ask the
user to (1) open the new-property form, (2) upload one photo straight from an
iPhone, (3) confirm the thumbnail shows (not a broken icon) and the photo can be
saved. Keep it to those steps.

### Definition of Done — Phase 2
- A failed file in a batch never discards the good ones; failures named clearly.
- Submitting is impossible until uploads finish; no silently-missing photos.
- HEIC strategy implemented and proven (probe + test); cover guard not bypassable
  by unknown-dimension images.
- `tsc` clean; upload smoke tests pass; ledger updated; §3 ticked.

---

# PHASE 3 — Client UX & Resilience Polish

**Theme:** Make every error legible, located, and recoverable — tuned for a
non-technical user — and stop accidental data loss.

**Closes:** C2 (inline UX), M1 (client display), M2, M3, M4, M5, M6, L1.

**Depends on:** Phase 1 COMPLETE (consumes the `fields` map the routes now
return) and ideally Phase 2 COMPLETE. Read both ledger entries first.

### Pre-flight reading
- `components/PropertyForm.tsx` — all field markup (input `name`s), the error
  display (currently one red line ~1186), the coordinate inputs (~1003–1030),
  the agents `useEffect` (~74–80).
- `app/properties/new/page.tsx` and the `app/` tree for error-boundary
  conventions (🔎 confirm none exist; Next 15 App Router `error.tsx` /
  `global-error.tsx`).

### Tasks

**3.1 — Inline, located field errors (C2 full, M1 display, M5).**
Consume the server `fields` map (and client-side checks) to render a plain
message **under each offending field**, plus a short summary near the submit
button and/or top of the form. On a failed submit, **scroll to the first error**
so the user isn't left staring at an unchanged screen. Keep messages in plain
language (§4D). 🔎 INVESTIGATE the lightest way to map `fields[name]` → the right
input without a heavy form library (the form is hand-rolled).

**3.2 — Coordinate paste UX (M2).**
Make the common behavior work: a user pastes "-1.2163, 36.7928". 🔎 Decide
between a single "Paste coordinates" field that splits into lat/lng, or smart
`onPaste` handling on the existing fields that detects a pair and fills both.
Validate ranges (reuse Phase 1's bounds) and message clearly if off-range.

**3.3 — Error boundaries (M3).**
Add an App-Router `error.tsx` (route-level, at least for `app/properties/` or
`app/properties/new/`) and a top-level `global-error.tsx`, styled to match the
app, with a plain "Something went wrong — try again / go back" and a reset
action. 🔎 Confirm Next 15 conventions and that they catch the intended throws.

**3.4 — Enter-to-submit guard (M4).**
Prevent a stray Enter in a single-line input from submitting the whole long
form; only the explicit button (or a deliberate action) submits. Don't break
the `ChipInput` Enter-to-add behavior or textarea newlines.

**3.5 — Unsaved-changes guard (M6).**
Warn before navigating away / closing the tab when the form is dirty (after
edits or uploads). 🔎 INVESTIGATE the right mechanism for Next App Router
(beforeunload for tab close + router navigation interception) without being
annoying on a clean form or right after a successful save.

**3.6 — Agent-list failure notice (L1).**
When `/api/agents` fails to load, show a small inline notice ("Couldn't load
agents — retry") with a retry, instead of a silently empty dropdown.

### Testing Protocol — Phase 3
**You run these:**
1. `npx tsc --noEmit` clean.
2. Logic-level checks where pure (e.g. a coordinate-pair parser → add cases to
   `scripts/test-logic.ts`).
3. Drive the dev server to confirm: a 422 from the server renders inline under
   the right field; the error boundary catches a forced throw (🔎 temporarily
   throw in a server component to verify, then revert); Enter in a text field
   does not submit. Where you can assert via DOM/HTTP, do so.
**Hand to the human (likely needed for UI feel) — keep it short and plain:**
1. Open the new-property form, click **Create property** with everything blank →
   confirm clear messages appear under the empty required fields and the page
   scrolls to the first one.
2. Paste "-1.2163, 36.7928" into the coordinates → confirm both lat and lng fill
   correctly.
3. Fill a few fields, then try to close the tab → confirm a "leave without
   saving?" warning appears. Save successfully → confirm it does **not** warn.

### Definition of Done — Phase 3
- Validation errors are inline, plain, and scrolled-to; no hunting.
- Coordinate paste "just works"; out-of-range is explained.
- A server-component crash shows a friendly boundary, not a raw stack.
- Enter doesn't fire premature submits; unsaved work is protected.
- Agent-list failures are visible and retryable.
- `tsc` clean; tests done; ledger updated; §3 fully ticked.

---

## 8 · WHY THIS ORDER (rationale, for the curious)

- **Phase 1 first** because it defines the two shared contracts —
  the error envelope and the zod schema — that the other phases consume. It also
  removes the two 🔴 risks (data integrity + UI hang) with the least surface
  area. Doing UX (Phase 3) before the server returns structured `fields` would
  mean building the inline display twice.
- **Phase 2 is a self-contained subsystem** (uploads) that mostly doesn't touch
  Phase 1's logic, so it can proceed with low conflict and be tested in
  isolation. HEIC is isolated here as the one real deep-dive.
- **Phase 3 is pure client polish** that *depends on* Phase 1's structured
  errors and benefits from Phase 2's upload states being settled. It's the most
  human-eyeball-heavy, so it's last.

**Efficiency notes baked in:** one zod schema is the single source of truth for
both client and server validation (no duplicate rule sets); `allSettled` avoids
re-uploading good files; HEIC is transcoded once at upload, not per brochure
render; the error envelope is defined once and reused everywhere.

---

## 9 · DONE = all three ledger entries COMPLETE, §3 fully ticked, `tsc` clean,
and a non-technical user can fill (or fumble) this form without ever hitting a
dead-end, losing work, or creating junk — and always understands what to fix.
