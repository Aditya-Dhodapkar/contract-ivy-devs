# Sansi Africa — Back Office

The private back-office system for Sansi Africa. The public website is a
separate codebase (not in this repo).

What's here:
- Login + 4-role permission system (Owner / Assistant / General Manager / Agent)
- Property management (CRUD, auto reference numbers, status, public/private,
  pre-publish checklist, Owner-only delete)
- Data model + Sanity schema for properties, users, contacts, documents, leads

Read **`deliverables.md`** for the full feature list and completion status, and
**`needs.md`** for what we still need from the client / manager.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind 3 · Sanity (data) · `jose` JWT
session · `bcryptjs` passwords. Same versions as the public website.

## Run it locally

```bash
npm install
cp .env.example .env.local      # fill AUTH_SECRET; keep USE_DEV_USERS=true
npm run dev                     # http://localhost:3001
```

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

`.env.local`:

```
AUTH_SECRET=<paste>
USE_DEV_USERS=true
```

`USE_DEV_USERS=true` switches the app to an in-repo dev backend:
- Users come from `lib/devUsers.ts` (no Sanity needed).
- Properties persist to `.devdata/properties.json` (gitignored).

### Dev logins (password is `password` for all)

| Email | Role |
|---|---|
| `owner@test.com` | Owner — everything, incl. delete |
| `assistant@test.com` | Assistant — create/edit/publish, no delete |
| `gm@test.com` | General Manager — read-only |
| `agent@test.com` | Agent — only own assigned properties |

When the client's Sanity project is created and granted to us, fill the Sanity
env vars and set `USE_DEV_USERS=false`. No application code changes.

## Tests

Pure-logic tests (reference numbers, pre-publish checklist):

```bash
node --experimental-strip-types scripts/test-logic.ts
```

Integration smoke tests (against a running dev server) live as one-off `curl`
flows — see commit history for the exact suite. Each route enforces RBAC
server-side via `lib/roles.ts` → `can()`, which is the single source of truth.

## Project layout

```
app/                    Next.js routes
  api/                  JSON API (auth, properties)
  properties/           List · new · detail pages
  dashboard/            Role-aware home
  login/                Sign-in page
components/             Header, PropertyForm, PropertyControls, StatusBadge
lib/
  roles.ts              4-role permission matrix — single source of truth
  auth.ts               JWT session helpers
  guard.ts              Auth + permission gate for API routes
  devUsers.ts           Dev login fallback (USE_DEV_USERS)
  referenceNumber.ts    SA-YYYY-NNN generator (immutable per record)
  prepublish.ts         Pre-publish checklist (returns what's missing)
  sanity.ts             Sanity client (env-driven)
  repo/
    properties.ts       Data layer — dev JSON OR Sanity, env-toggled
    documents.ts        Stub for Step 3 (document storage)
sanity/schemas/         Sanity document schemas
middleware.ts           Route guard — bounces unauthenticated to /login
```

## Hard rules to preserve (from the build brief)

1. **Only the Owner can delete a property.** Every other role is hard-blocked
   server-side — even if the UI ever exposed a button by accident.
2. **Private listings never appear in any public list or search.** Visibility
   forced off when `isPrivate=true`.
3. **Every sensitive-document access is logged.** (Implemented in Step 3.)
4. **Nothing AI-generated is sent automatically.** (Phase 2.)
5. **The reference number is the single source of truth** across website, back
   office, and brochures. Never editable, never reissued.
6. **Mobile-first.** The founder runs the business from her phone.
