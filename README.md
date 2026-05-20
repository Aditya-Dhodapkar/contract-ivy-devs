# Sansi Africa — Back Office

The private back-office system for Sansi Africa. The public website is a
separate codebase (not in this repo).

What's here:
- Login + 4-role permission system (Owner / Assistant / General Manager / Agent)
- Property management (CRUD, auto reference numbers, status, public/private,
  pre-publish checklist, Owner-only delete, approval workflow)
- Team management (invite / edit / reset password / deactivate / delete)
- Photo upload + reorder + primary picker
- Themed modal layer (no native browser dialogs)

Read **`deliverables.md`** for the full feature list and completion status, and
**`needs.md`** for what we still need from the client / manager.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind 3 · **Supabase** (Postgres + Storage) ·
`jose` JWT session · `bcryptjs` passwords. Same Next/React versions as the
public website.

## Run it locally (no Supabase needed)

```bash
npm install
cp .env.example .env.local      # fill AUTH_SECRET, keep USE_DEV_DATA=true
npm run dev                     # http://localhost:3001
```

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

`USE_DEV_DATA=true` switches the app to an in-repo dev backend:
- Users come from `lib/devUsers.ts` (4 seed accounts, see below)
- Properties persist to `.devdata/properties.json` (gitignored)
- Photo uploads land in `public/uploads/` (gitignored)

No cloud accounts required for development.

### Dev logins (password is `password` for all)

| Email | Role |
|---|---|
| `owner@test.com` | Owner — everything, incl. delete |
| `assistant@test.com` | Assistant — create/edit/publish, no delete |
| `gm@test.com` | General Manager — read-only |
| `agent@test.com` | Agent — only own assigned properties |

## Production setup (Supabase)

When ready to run against a real database:

1. Create a Supabase project at <https://supabase.com> (free tier is fine).
   Pick a region close to Kenya (Frankfurt / London).
2. Open **SQL Editor → New query** → paste `migrations/001_init.sql` → **Run**.
3. Open **Storage → New bucket** → name it `property-photos` (or match
   `SUPABASE_STORAGE_BUCKET` in your env). Make it **Public**.
4. Copy from **Project Settings → API**: project URL, anon key, service-role key.
5. Fill `.env.local`:

   ```
   SUPABASE_URL=...
   SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_STORAGE_BUCKET=property-photos
   USE_DEV_DATA=false
   ```

6. Restart `npm run dev`. The back-office now reads/writes Supabase.

See `migrations/README.md` for how to apply future schema changes.

> **Caveat:** the Supabase backend code is typechecked but has not yet been
> exercised against a live project. The first deploy will be the integration
> test. The dev (JSON) backend is fully covered by the smoke tests below.

## Tests

Pure-logic tests (reference numbers, pre-publish checklist):

```bash
node --experimental-strip-types scripts/test-logic.ts
```

Integration smoke tests run via Node `fetch` against a running dev server —
see commit history for the suite. Every route enforces RBAC server-side via
`lib/roles.ts` → `can()`, which is the single source of truth.

## Project layout

```
app/                    Next.js routes
  api/                  JSON API (auth, properties, users, profile, upload, approvals)
  properties/           List · new · detail
  team/                 List · new · detail (Owner-only)
  approvals/            Pending-approval queue (Owner-only)
  profile/              Self-service: name, email, password
  dashboard/            Role-aware home with side panel
  login/                Sign-in page
components/             Header, PropertyForm, PropertyControls, UserForm,
                        ApprovalBadge, StatusBadge, WebsiteBadge, ChipInput,
                        ModalShell, DeleteUserButton, DeactivateButton,
                        ResetPasswordButton, ProfileForms
lib/
  roles.ts              4-role permission matrix — single source of truth
  auth.ts               JWT session helpers
  guard.ts              Auth + permission gate for API routes
  devUsers.ts           Dev login seeds + USE_DEV_DATA flag
  referenceNumber.ts    SA-YYYY-NNN generator (immutable per record)
  prepublish.ts         Pre-publish checklist (returns what's missing)
  format.ts             KES currency formatter
  relative.ts           Relative-time formatter
  storage.ts            File upload — local FS in dev, Supabase Storage in prod
  supabase.ts           Supabase client (server-only, service-role key)
  repo/
    properties.ts       Property data layer — JSON OR Supabase, env-toggled
    users.ts            Team data layer  — JSON OR Supabase, env-toggled
    documents.ts        Stub for Step 3 (document storage)
migrations/             SQL schema (apply via Supabase SQL editor)
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
