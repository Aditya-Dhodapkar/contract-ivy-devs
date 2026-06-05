# Sansi Africa Back-Office — Handoff

A complete dev handoff. Read this in order; by the end you should know what's been built, why we built it that way, where everything lives, and what's worth picking up next.

> **Companion docs:** `README.md` (run-it-locally), `deliverables.md` (atomic feature checklist), `needs.md` (what's blocked on the client), `progress-so-far.md` (legacy doc — slightly out of date; this file supersedes it for architecture).

---

## 0 · TL;DR

- **What it is:** A Next.js 15 back-office for a Kenyan luxury real-estate agency (Sansi Africa). Four roles, property CRUD, approval workflow, sensitive-document storage, an AI-driven brochure generator, and a public-website Phase-2 hookup that's still mostly future-tense.
- **Stack:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 3 + custom JWT auth + Supabase (Postgres + Storage) for prod / JSON-file backend for dev + Anthropic Claude for AI copy + Puppeteer for PDF rendering + Mapbox for the brochure's locality map.
- **Where we are:** Phase 1 is **functionally complete**. The brochure generator, document storage, approval workflow, role system, photo handling — all working end-to-end on the dev backend. **Production deploy is unblocked technically** (Supabase code path written, Vercel-ready Puppeteer swap is a 2-hour task) — held up only by **client provisioning** (Supabase account, Meta Business Verification, Zoho App Password).
- **What's blocked:** anything WhatsApp / lead capture (Phase 2 — needs Meta Business Verification, 1–3 week lead). Email send paths (needs Zoho App Password + domain verification).
- **What an incoming dev should do:** see §11 at the end. Top items: Vercel-ready Puppeteer swap (must-do), mobile responsiveness pass, pre-publish UI surfacing, photo caption inline edits.

---

## 1 · The product, in one paragraph

Carol Lees runs a brand-new luxury real-estate practice in Kenya (Sansi Africa). She's a celebrated agent with no digital infrastructure — every prior listing lived in a notebook, every inquiry in WhatsApp. We're building her back-office: a private CRM-ish app where she + a small team add properties, manage sensitive documents (signed mandates, title deeds, deed plans), generate polished PDF brochures on demand, and eventually (Phase 2) capture leads from WhatsApp / email / web with AI-drafted replies she approves from her phone. **Mobile-first is non-negotiable** — she runs the business from her phone. The public website (separate repo `kenya/sansiwebsite`) is already done; this app feeds it and supports the team behind it.

---

## 2 · Architecture decisions, with rationale

Every choice below was deliberate — read the **Why** before changing anything.

### 2.1 Custom JWT auth (not Supabase Auth)

- Sessions = `jose` JWT in an httpOnly cookie + `bcryptjs` password hash.
- **Why:** Supabase Auth is fine but locks you into their UI flows and middleware. Custom auth is ~150 lines, role enforcement happens in `lib/roles.ts` + `lib/guard.ts`, totally independent of where users are stored. Easier to hand off, easier to test, no Supabase Auth-specific quirks to remember.
- **Trade-off:** if we ever want SSO / social login, we'd have to wire that ourselves. Not a current need.

### 2.2 Two-backend pattern: dev = JSON files, prod = Supabase

- Single env flag `USE_DEV_DATA` (default `true` in `.env.local`) switches every repo function.
- Dev backend writes to `.devdata/*.json` files (gitignored). No cloud accounts needed to develop.
- Prod backend hits Supabase Postgres + Storage via service-role key.
- **Why:** Zero-friction onboarding (clone, `npm install`, `npm run dev`, log in, you're working). Also catches "did you mean to test against real data?" mistakes — opt-in instead of default.
- **Where it's wired:** `lib/repo/*.ts` files branch on `usingDevData`. `lib/storage.ts` branches the same way. Everything else is backend-agnostic.

### 2.3 Per-page brochure templates + Puppeteer (not React-PDF)

- The brochure is **6 separate HTML files** in `templates/brochure/` interpolated with `{{slot}}` placeholders, concatenated, then Puppeteer renders to A4 PDF.
- **Why we tried `@react-pdf/renderer` first and ditched it:** React-PDF can't load Google Fonts via CDN (its bundler 404s on the static-TTF paths). The brochure design needs Cormorant Garamond + JetBrains Mono — falling back to Times-Roman lost the editorial feel.
- **Why per-page:** each template has 2-5 AI slots (max), small focused Claude prompts (cheaper, faster), and we can swap one page out without re-validating the others. Designer (or marketing person) can iterate on a single page's HTML/CSS without touching code.
- **Trade-off:** Puppeteer adds ~150MB of Chromium to the function bundle. Vercel deploy needs `puppeteer-core` + `@sparticuz/chromium` to fit under the limit. See §11.

### 2.4 The brochure is stateless (no archive)

- Every "Generate brochure" click is a fresh AI draft + Puppeteer render. PDF streams to the user's downloads. Nothing saved server-side.
- **Why:** the client explicitly didn't want server-side brochure storage (legal exposure if a wrong version leaks; staleness if details change). Regeneration is cheap (~$0.05 + ~15s), so "redo it" is a button press.
- Deliverable #75 (archive previous version) is intentionally **un-built** for this reason.

### 2.5 Photo allocator: single source of truth for "which photo on which page"

- Before this existed, the same photo could appear on the cover AND in the gallery. The allocator (`lib/brochure/photo-allocator.ts`) is the chokepoint: cover = `photos[0]`, page-3 variant reserves what it needs, gallery gets the leftovers, **no photo appears twice** unless the user explicitly picks it.
- **Why:** brochures are editorial. Repeating photos looks careless.

### 2.6 Photo dimensions captured AT upload time

- `/api/upload` runs the file through `sharp` server-side to get `width × height`, returns them with the URL, the form stores them in `photo_dimensions JSONB`.
- For older photos missing this, the gallery editor falls back to `new Image().naturalWidth` client-side and **backfills via POST `/photo-dimensions`** so next session it's instant.
- **Why we care:** the cover (page 1) is A4 portrait — a landscape photo gets brutally cropped. We block landscape from being primary in the form (★ button disabled), and the brochure render double-checks and falls back to a solid forest-green panel if a landscape sneaks in (legacy data).

### 2.7 Tile aspect = photo aspect (no crop, ever)

- The gallery uses **row-based masonry**: photos in a row share a height, each photo's width = `height × natural aspect`, the row scales to fit page width exactly. Mathematically, **tile aspect ratio always equals photo aspect ratio.** `object-fit: cover` becomes a no-op — there's nothing to crop and nothing to letterbox.
- **Why this matters:** every previous approach (CSS grid with fixed spans, fixed-shape tiles, smart shape-matching) eventually cropped some photo or whitespaced around it. The masonry approach makes cropping mathematically impossible.

### 2.8 Templates over free-form drag-and-drop

- The gallery editor offers **11 hand-curated row-partition templates** (pair + trio combinations only — no strips, no solo-row heroes). User picks one; photos fill slots in upload order.
- **Why:** we tried drag-and-drop. It was fiddly on mobile, easy to make ugly, and didn't actually produce better output than a well-chosen template. Templates guarantee editorial quality and limit the user's decision surface to "which of these 3 looks right?"
- **AI shortcut:** "✨ Let AI design" sends the photos + property context to Claude vision (Sonnet 4.5). Claude returns `{ templateId, photoOrder }`. Editor switches to it. ~$0.05 per call.

### 2.9 Five page-3 variants for seller-privacy options

- Page 3 used to always be "Location & Neighbourhood" with a map. But some sellers want the location withheld (private listings, high-profile clients).
- Now there are five alternatives, each with its own AI prompt + HTML template + photo budget:
  1. **Location** (default) — Mapbox locality map + nearby places list
  2. **Within reach** — nearby list only, no map pin
  3. **Photo essay** — three large photos (photos[1..3]) with extended editorial captions
  4. **The setting** — atmospheric prose only, zero place names
  5. **Provenance** — heritage timeline (built, restored, in-hand) + photo inset

- The owner picks one per brochure via `Page3VariantEditor`. The photo allocator coordinates so e.g. photo-essay reserves `photos[1..3]` and the gallery picks up from `photos[4..]`.

### 2.10 RBAC is a single object literal

- `lib/roles.ts` exports the entire permission matrix as a flat object. `can(role, capability, ctx)` is the single function every route calls.
- **Why:** zero abstraction overhead, trivial to audit ("can an Agent delete a property?" → grep `deleteProperty` in `roles.ts` → false).
- Some routes also have **belt-and-braces hard checks** (e.g. property delete: `if (user.role !== "owner") return 403` after the `can()` check). Brief said "ONLY the owner" — we hard-coded it twice.

### 2.11 Mandate gate enforced by data, not UI

- The pre-publish checklist (`lib/prepublish.ts`) calls `hasMandateDoc(propertyId)` which queries the documents table. **It's not a UI flag — it's the actual data state.**
- Means: even if a future UI bug lets her toggle "mandate uploaded" without uploading one, the gate still fires. Document upload is the only way to satisfy it.

### 2.12 Documents bytes always proxied (never linked)

- The download route (`/api/properties/[id]/documents/[docId]/download`) is the **only** path bytes leave the server. It auth-gates, logs the access (view vs. download), then streams.
- No CDN links, no signed Supabase URLs leaked to the client. Means the access log can never be bypassed.
- **Why:** title deeds + signed mandates are legally sensitive. Audit trail is non-negotiable.

---

## 3 · The brochure system in depth

By far the biggest piece of work in this codebase. Worth understanding deeply.

### 3.1 The 6 pages

| # | Page | Inclusion rule | Template file | AI slots |
|---|---|---|---|---|
| 1 | **Cover** | always | `01-cover.html` | `{ eyebrow, title, sub }` |
| 2 | **At a glance** | always | `02-glance.html` | `{ headline, priceTagline, blurb, bodyPara1, bodyPara2 }` |
| 3 | **Page 3 (variant)** | one of 5 — see below | `03-*.html` | varies (see §3.2) |
| 4 | **Site plan & particulars** | `showPlotOnBrochure ≠ false` & (floor plan OR any particular set) | `04-site-plan.html` | `{ headline }` |
| 5 | **Gallery / On the ground** | `photos.length ≥ 3` | `05-feature.html` | `{ headline, intro, closing }` |
| 6 | **Terms & enquiries** | always | `06-closing.html` | `{ headline, terms }` |

Inclusion rules live in `lib/brochure/pages.ts`. The closing is always last; the cover is always first.

### 3.2 Page 3 variants

The owner picks one via `Page3VariantEditor`:

| Variant | Slots | Photo budget | Notes |
|---|---|---|---|
| `location` | `LocationSlots` (headline, intro, closing) | 0 photos (uses Mapbox embed) | Default. Requires `city`. |
| `within-reach` | `WithinReachSlots` (headline, intro) | 0 photos (nearby list only) | Requires ≥2 entries in `nearby` array. |
| `photo-essay` | `PhotoEssaySlots` (page headline + 3 × {label, headline, body}) | Reserves `photos[1..3]` | **Requires ≥9 total photos** (1 cover + 3 essay + 5 gallery, no repeats). |
| `the-setting` | `TheSettingSlots` (headline, 2 italic paras, 4 fact pairs) | 0 photos | Always available. Atmospheric prose, zero place names. |
| `provenance` | `ProvenanceSlots` (3 paras, 4 timeline captions) | Reserves `photos[1]` | Requires `restoration_notes` for grounded AI. Always available. |

The variant choice is sent to `/pdf-v2` as `body.page3Variant`. `pagesFor(p, variant)` selects the right `PageId`.

### 3.3 Photo allocator (`lib/brochure/photo-allocator.ts`)

Single source of truth for which photo goes where:

```
photos[0] → cover (page 1)
  ├─ if landscape: skip → render forest-green fallback panel
  └─ if portrait/square: use as cover background

photos[1..N] → page-3 reservation depends on variant
  ├─ location / within-reach / the-setting: reserves NOTHING
  ├─ photo-essay: reserves photos[1..3]
  └─ provenance: reserves photos[1]

remaining photos → gallery (page 5)
  ├─ hard cap at 6 (2-row max)
  └─ optionally reordered if user picked a template + photoOrder
```

**Key invariant:** in auto mode, no photo appears twice across the brochure. In explicit mode (user-picked template + order), we honor their choices verbatim.

### 3.4 Layout engine (`lib/brochure/gallery-layout.ts`)

For the page-5 gallery only. Given a list of photos + a chosen template (row partition), produces `Row[]` where each row has a pixel height and per-photo `widthPct` totals to 100.

The math (for each row):
```
totalNaturalWidth = Σ (targetH × photoAspect_i)
scale = pageW / totalNaturalWidth
actualH = targetH × scale
photo_i.widthPct = (actualH × photoAspect_i) / pageW × 100
```

Guarantees:
1. Sum of `widthPct` for each row = 100% (row fills page width exactly).
2. Tile aspect ratio = photo aspect ratio (object-fit cover is a no-op).
3. If total page height would exceed 700px, all rows scale proportionally — preserves aspect ratios, just shrinks the whole thing.

### 3.5 Template catalog (`lib/brochure/templates.ts`)

11 hand-curated templates. **Constraint: every row is exactly 2 (pair) or 3 (trio) photos.** No solo-row heroes, no strip layouts.

| Count | Templates | Notes |
|---|---|---|
| 1 | `1-single` | One full photo |
| 2 | `2-pair` | Side by side |
| 3 | `3-trio` | One row of three |
| 4 | `4-pair-pair` | 2 × 2 |
| 5 | `5-pair-trio`, `5-trio-pair` | Pair on top, trio below — or reversed |
| 6 | `6-trio-trio`, `6-pair-pair-pair` | Two trios, or three pairs |
| 7 | `7-pair-pair-trio`, `7-pair-trio-pair`, `7-trio-pair-pair` | All combos of 2 pairs + 1 trio |

### 3.6 Prompts (12 + 1 legacy)

Every AI slot has its own prompt module. Each enforces:
- British English, restrained tone
- A list of banned clichés (luxurious, stunning, breathtaking, perfect, dream, immaculate, exquisite, gem, oasis, sanctuary)
- HTML-safe markup (`<em>`, `<br/>` allowed; nothing else)
- Headlines max 6 words / 50 characters (because the brochure renders them at 60-96pt serif — 3+ lines is visually unacceptable)

```
lib/brochure/prompts/
├── cover.ts          → page 1 (eyebrow, title, sub)
├── glance.ts         → page 2 (headline, priceTagline, blurb, bodyPara1, bodyPara2)
├── location.ts       → page 3a (headline, intro, closing)
├── within-reach.ts   → page 3b (headline, intro)
├── photo-essay.ts    → page 3c (page headline + 3 fig blocks)
├── the-setting.ts    → page 3d (headline, 2 paras, 4 fact pairs)
├── provenance.ts     → page 3e (3 paras, 4 timeline captions)
├── site-plan.ts      → page 4 (headline)
├── feature.ts        → page 5 (headline, intro, closing)
├── closing.ts        → page 6 (headline, terms)
├── caption.ts        → per-photo gallery caption (2-4 word editorial tag, fans out)
├── ai-layout.ts      → vision-driven { templateId, photoOrder } picker
└── description.ts    → legacy monolithic prompt (kept for React-PDF prototype)
```

All use Claude Sonnet 4.5, temperature 0.4, `tool_choice` forced (JSON-schema'd output, no prose drift).

### 3.7 Cost

Per brochure render (without prompt caching):
- ~10k input tokens × $3/M = $0.03
- ~1.2k output tokens × $15/M = $0.018
- **~$0.05 per brochure.**

AI layout designer (vision call):
- ~7.5k input tokens including 5 photos × ~1.5k each
- ~250 output tokens
- **~$0.05 per AI layout call.**

So a typical "generate → tweak → AI layout → generate again" cycle costs ~$0.15. Negligible.

### 3.8 The render pipeline

```
POST /api/properties/[id]/brochure/pdf-v2
  ├── 1. Auth + load property
  ├── 2. pagesFor(p, page3Variant) → list of PageIds
  ├── 3. allocatePhotos(p, ...) → cover, page-3 photos, gallery URLs
  ├── 4. Parallel:
  │     ├── Resolve all images → data URIs (Puppeteer can't auth)
  │     ├── Fetch Mapbox locality map (if location variant + coords)
  │     └── Draft AI copy for each page (parallel Claude calls)
  ├── 5. assembleBrochureHtml({ property, aiSlots, pages, images })
  │     ├── Build flat {{slot}} → value map per page
  │     ├── Load + interpolate each page's template
  │     └── Wrap in _shell.html
  ├── 6. Puppeteer launch → setContent → wait document.fonts.ready → page.pdf({ A4, margin: 0 })
  └── 7. Stream PDF as attachment
```

Total: ~10–20 seconds per render. Bottleneck is Claude calls in parallel (slowest one wins).

---

## 4 · Documents system

### 4.1 The three documents

| Type | Required? | Why |
|---|---|---|
| `mandate` | **Yes** | Pre-publish gate — without this, property cannot go live |
| `title_deed` | No | Buyers' lawyers will ask. Stored for completeness. |
| `deed_plan` | No | Same |

### 4.2 Storage

Different from photos: documents are **private**.

- **Dev:** `.devdata/documents/{propertyId}/{docId}.{ext}` — outside `public/`, never statically served.
- **Prod:** Supabase Storage bucket `property-documents` (separate from photos bucket, configured as private — anonymous reads denied).

### 4.3 Access log

Every doc has `access_log JSONB` — appended to on:
- `upload` / `replace` — when a file is added or overwritten
- `view` — when opened inline via download route
- `download` — when forced-save via `?as=download`
- (`delete` — last event before the row goes away)

Each entry: `{ userId, userEmail, action, at }`.

### 4.4 Permission matrix

| | Owner | Assistant | GM | Agent (own) | Agent (other) |
|---|---|---|---|---|---|
| List | ✅ | ✅ | ✅ | ✅ | 403 |
| View | ✅ | ✅ | ✅ | ✅ | 403 |
| Download | ✅ | ✅ | ✅ | ✅ | 403 |
| Upload | ✅ | ✅ | ❌ | ✅ | 403 |
| Replace | ✅ | ✅ | ❌ | ✅ | 403 |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| See access log UI | ✅ | ❌ | ❌ | ❌ | ❌ |

### 4.5 Routes

- `GET /api/properties/[id]/documents` — list metadata only (no bytes)
- `POST /api/properties/[id]/documents` — upload (multipart, 25 MB cap, MIME allowlist: PDF + image)
- `DELETE /api/properties/[id]/documents/[docId]` — Owner-only
- `GET /api/properties/[id]/documents/[docId]/download` — the bytes chokepoint (auth → log → stream)

---

## 5 · Role + approval system

### 5.1 The 4 roles

| Capability | Owner | Assistant | GM | Agent |
|---|---|---|---|---|
| viewProperties | all | all | all | own |
| createProperty | ✅ | ✅ | ❌ | ✅ (own) |
| editProperty | all | all | ❌ | own |
| **deleteProperty** | ✅ | ❌ | ❌ | ❌ |
| publishToWebsite | all | all | ❌ | own |
| viewDocuments | all | all | all | own |
| uploadDocument | all | all | ❌ | own |
| deleteDocument | ✅ | ❌ | ❌ | ❌ |
| viewInquiries | all | all | all | own |
| viewReports | ✅ | ✅ | ✅ | ❌ |
| manageUsers | ✅ | ❌ | ❌ | ❌ |
| generateBrochure | ✅ | ✅ | ✅ | ❌ |

### 5.2 Approval workflow

- Owner-created property → auto `approved`.
- Anyone-else-created → `pending`.
- Owner edits an approved property → stays `approved`.
- Non-Owner edits any property → resets to `pending` (per brief).
- Publish-to-website blocked unless `approval === "approved"` AND pre-publish checklist passes.
- Owner has dedicated routes: `/approve`, `/request-changes` (with note).
- Dashboard side-panel shows pending count for Owner.
- `/approvals` page (Owner-only) is the queue view.

---

## 6 · Form + photo handling

### 6.1 PropertyForm.tsx

One big form (~1000 lines). Handles create + edit. Worth knowing:

- **Comma-grouped price input.** Live formatting via `Intl.NumberFormat`. Raw digits parsed at submit.
- **Nearby places** = structured `{place, distance, description}[]` repeater. Per-row remove. Used by page-3 location variant.
- **Highlights + amenities** = chip inputs (ChipInput component).
- **Photo grid** with these affordances:
  - Multi-file upload via `/api/upload`
  - Per-photo: ← → reorder, ★ make primary (disabled on landscape), ✕ remove
  - Inline caption text input under each thumbnail (max 80 chars)
  - Orientation badge (green PORTRAIT / red LANDSCAPE / grey SQUARE)
  - Captions tracked URL→string so reorder doesn't scramble them
  - Dimensions tracked URL→{w,h} for the cover guard
- **Brochure toggles**: `showMapOnBrochure`, `showPlotOnBrochure` (owner unticks per property when seller asked for privacy).
- **Submission**: client-side useRef lock + UUID idempotency key + server unique constraint = 3 layers against double-submit.

### 6.2 Image upload pipeline

`POST /api/upload` (multipart, 10 MB cap):
1. Validate MIME via `isAllowedImage()` (jpg, png, webp, gif, heic)
2. Run buffer through `sharp().rotate().metadata()` → captures `{w, h}` (rotate respects EXIF)
3. Store: dev → `public/uploads/{uuid}.{ext}`, prod → Supabase Storage `property-photos` bucket (public read)
4. Return `{ url, key, width, height }`

The dimensions are persisted in the property record's `photo_dimensions JSONB` array (aligned with `photos`). For older photos missing dims, the gallery editor backfills client-side via `Image().naturalWidth` and POSTs to `/api/properties/[id]/photo-dimensions` — fire-and-forget.

---

## 7 · Code organization (where to find what)

```
backoffice/
├── README.md                     run-it-locally guide
├── HANDOFF.md                    ★ this file ★
├── deliverables.md               138 atomic features w/ status
├── needs.md                      what's blocked on the client
├── progress-so-far.md            legacy doc (partially out of date)
│
├── .env / .env.local             secrets (gitignored)
├── .env.example                  template
│
├── migrations/                   9 SQL files; apply in order
│   ├── 001_init.sql              base schema
│   ├── 002_brochure_fields.sql   facing dir, plot dims, toggles
│   ├── 003_brochure_glance_fields.sql
│   ├── 004_property_coords.sql   lat, lng
│   ├── 005_brochure_site_plan_fields.sql
│   ├── 006_brochure_photo_captions.sql
│   ├── 007_photo_dimensions.sql
│   ├── 008_restoration_notes.sql
│   └── 009_floor_plans_multi.sql
│
├── templates/brochure/           per-page HTML
│   ├── _shell.html               fonts, CSS, {{PAGES}} insertion
│   ├── 01-cover.html
│   ├── 02-glance.html
│   ├── 03-location.html          page-3 variant: location + map
│   ├── 03-within-reach.html      page-3 variant: nearby list only
│   ├── 03-photo-essay.html       page-3 variant: 3-photo editorial
│   ├── 03-the-setting.html       page-3 variant: prose + facts
│   ├── 03-provenance.html        page-3 variant: heritage timeline
│   ├── 04-site-plan.html
│   ├── 05-feature.html
│   └── 06-closing.html
│
├── lib/
│   ├── auth.ts                   JWT session helpers
│   ├── roles.ts                  ★ RBAC source of truth ★
│   ├── guard.ts                  auth + permission gate for routes
│   ├── devUsers.ts               4 dev users + USE_DEV_DATA flag
│   ├── referenceNumber.ts        SA-YYYY-NNN generator (pure, tested)
│   ├── prepublish.ts             checklist (pure, tested)
│   ├── format.ts                 KES currency
│   ├── relative.ts               relative-time strings
│   ├── supabase.ts               server-only Supabase client
│   ├── storage.ts                file upload adapter (dev FS / prod Supabase)
│   │
│   ├── repo/                     data layer
│   │   ├── properties.ts         dev JSON ↔ Supabase
│   │   ├── users.ts              same
│   │   └── documents.ts          documents (sensitive)
│   │
│   └── brochure/
│       ├── types.ts              all SlotsXxx interfaces
│       ├── pages.ts              pagesFor(p, page3Variant) → PageId[]
│       ├── photo-allocator.ts    ★ single source of truth for photo placement ★
│       ├── photo-fetch.ts        URL → base64 (for Claude vision)
│       ├── gallery-layout.ts     row-based masonry math
│       ├── templates.ts          11 hand-curated row partitions
│       ├── assembler.ts          slot interpolation + template assembly
│       ├── claude.ts             Anthropic SDK wrapper (per-page draft fns)
│       ├── prompts/              12 prompt modules + ai-layout + legacy
│       ├── prompt.ts             LEGACY (React-PDF prototype)
│       └── template.tsx          LEGACY (React-PDF prototype)
│
├── app/
│   ├── login/                    auth
│   ├── dashboard/                home screen, role-aware
│   ├── profile/                  self-service
│   ├── team/                     Owner user mgmt
│   ├── approvals/                Owner-only pending queue
│   ├── properties/
│   │   ├── page.tsx              list
│   │   ├── new/page.tsx          create
│   │   ├── [id]/page.tsx         detail (+ DocumentsPanel)
│   │   └── [id]/brochure/page.tsx
│   │       (mounts BrochureEditor → GalleryTemplateEditor + Page3VariantEditor)
│   │
│   └── api/
│       ├── auth/                 login, logout
│       ├── profile/              self password change
│       ├── users/                CRUD + reset + deactivate
│       ├── agents/               picker source
│       ├── upload/               photos (sharp dims)
│       ├── feedback/             → GitHub Issues
│       └── properties/
│           ├── route.ts                          list, create
│           ├── [id]/route.ts                     get, patch, delete
│           ├── [id]/status/route.ts              status change
│           ├── [id]/visibility/route.ts          private toggle
│           ├── [id]/publish/route.ts             publish gate
│           ├── [id]/approve/route.ts             Owner-only
│           ├── [id]/request-changes/route.ts     Owner-only
│           ├── [id]/photo-dimensions/route.ts    backfill dims
│           ├── [id]/documents/
│           │   ├── route.ts                      list, upload
│           │   ├── [docId]/route.ts              delete
│           │   └── [docId]/download/route.ts     ★ bytes chokepoint ★
│           └── [id]/brochure/
│               ├── draft/route.ts                LEGACY
│               ├── pdf/route.ts                  LEGACY
│               ├── pdf-v2/route.ts               ★ the real one ★
│               └── ai-layout/route.ts            vision-driven layout picker
│
├── components/
│   ├── Header.tsx                site-wide (with Feedback button)
│   ├── FeedbackButton.tsx        → GitHub Issues modal
│   ├── PropertyForm.tsx          long create/edit form
│   ├── PropertyControls.tsx      detail sidebar (status, publish, brochure, delete)
│   ├── PhotoStrip.tsx            scrollable photo strip + lightbox
│   ├── DocumentsPanel.tsx        sensitive docs UI
│   ├── BrochureEditor.tsx        ★ brochure generation page ★
│   ├── GalleryTemplateEditor.tsx ★ template picker for page 5 ★
│   ├── Page3VariantEditor.tsx    page-3 variant picker
│   ├── UserForm.tsx
│   ├── ProfileForms.tsx
│   ├── ChipInput.tsx             chips for highlights / amenities
│   ├── ModalShell.tsx            ★ themed confirm/prompt modal ★
│   ├── ApprovalBadge.tsx
│   ├── StatusBadge.tsx
│   ├── WebsiteBadge.tsx
│   ├── DeleteUserButton.tsx
│   ├── DeactivateButton.tsx
│   └── ResetPasswordButton.tsx
│
├── middleware.ts                 route guard (bounces unauth to /login)
└── scripts/
    └── test-logic.ts             12 pure-logic unit tests
```

---

## 8 · Local dev quickstart

```bash
git clone https://github.com/Aditya-Dhodapkar/contract-ivy-devs.git
cd contract-ivy-devs

npm install

# env
cp .env.example .env.local
# in .env.local set:
#   AUTH_SECRET=$(openssl rand -base64 32)
#   USE_DEV_DATA=true
# optionally also create .env with:
#   ANTHROPIC_API_KEY=sk-ant-...      (needed for brochure)
#   MAPBOX_TOKEN=pk.eyJ1...            (needed for brochure locality map)
#   GITHUB_FEEDBACK_TOKEN=...           (needed for feedback button)
#   GITHUB_FEEDBACK_REPO=Aditya-Dhodapkar/contract-ivy-devs

npm run dev          # http://localhost:3001 (defaults — but might collide if you have other dev servers)

# typecheck
npx tsc --noEmit

# pure-logic tests
node --experimental-strip-types scripts/test-logic.ts
```

**Dev login** (password `password` for all):
- `owner@test.com` → Owner
- `assistant@test.com` → Assistant
- `gm@test.com` → General Manager
- `agent@test.com` → Agent

---

## 9 · Production prerequisites

In dependency order:

### 9.1 Vercel-ready Puppeteer **(REQUIRED before any deploy works)**

The current `puppeteer` package downloads ~150MB of Chromium and blows past Vercel's function size limit. The brochure render route will silently fail in production. Fix:

```bash
npm uninstall puppeteer
npm install puppeteer-core @sparticuz/chromium
```

Then update `app/api/properties/[id]/brochure/pdf-v2/route.ts`:

```ts
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

// inside POST handler, replace the launch call:
const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
});
```

Test locally with same setup. ~2 hours including a smoke test.

### 9.2 Supabase provisioning (client-side task)

Carol creates a Supabase project under her account + billing. We get:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Two storage buckets created: `property-photos` (public) + `property-documents` (private)

Then apply all 9 migrations in order via the Supabase SQL editor. Then deploy with `USE_DEV_DATA=false`.

**The Supabase code path has never been tested against a real project** — first deploy IS the integration test. Build a smoke script (`scripts/test-supabase-integration.ts`) before going live.

### 9.3 Vercel deploy

After above:
- New Vercel project linked to the GitHub repo
- All env vars set (see `.env.example`)
- Custom domain: `admin.sansi.africa` or similar
- Vercel GitHub app needs access to the private repo (works fine with private repos — repo stays private, deploy is public)

### 9.4 Pre-flight checklist before going live

- [ ] Vercel-ready Puppeteer applied (§9.1)
- [ ] Supabase project provisioned + all 9 migrations applied
- [ ] Storage buckets created (public photos, private documents)
- [ ] `AUTH_SECRET` regenerated for prod (don't reuse the dev value)
- [ ] `USE_DEV_DATA=false` set on Vercel
- [ ] At least one real Owner user seeded in Supabase (the founder)
- [ ] Domain pointed at the deployment
- [ ] Smoke-test: log in, create property, generate brochure, upload mandate, check status changes, check approval queue
- [ ] Mark deliverable #121 (Vercel) and #123 (Supabase) ✅

---

## 10 · Critical things NOT to break

- **`lib/roles.ts` matrix.** Single source of truth. Any change here ripples through every API route. If you adjust it, update the table in §5.1 of this doc so the next reader isn't confused.
- **Owner-only delete checks.** Both `can()` AND an explicit `if (user.role !== "owner")` — keep both as belt-and-braces.
- **Reference numbers are immutable.** The repo strips `referenceNumber` from any PATCH body.
- **Approval state is set ONLY via `/approve` and `/request-changes`.** The generic PATCH strips it.
- **Documents bytes never leave server except via the download route.** Don't add a direct CDN link feature without rebuilding the access log story.
- **`USE_DEV_DATA` env flag.** Don't remove the back-compat read of the legacy `USE_DEV_USERS` name.
- **Photo allocator's no-reuse rule** in auto mode. If you change this, you'll get the "same photo on page 1 and page 5" bug back.
- **Tile aspect = photo aspect** in the gallery math. Don't try to "improve" it by shape-matching tiles — that's how cropping comes back.
- **Headlines capped at 6 words / 50 chars** in AI prompts. Loosen this and three-line headlines on the cover + page 3 will return.

---

## 11 · Work list for the next dev

Pickable items that are **not blocked** by external accounts. Prioritized.

### Must-do before deploy (technical debt that gates production)

1. **Vercel-ready Puppeteer swap** — see §9.1. Without this the brochure breaks in prod. **~2 hours.**
2. **Brochure cleanup** — tear out legacy React-PDF code (`lib/brochure/template.tsx`, `lib/brochure/prompt.ts`, `app/api/.../brochure/draft/route.ts`, `app/api/.../brochure/pdf/route.ts`). Then rename `/pdf-v2` → `/pdf` and update the `BrochureEditor.tsx` fetch call. Pure cleanup. **~1 hour.**
3. **Update legacy `progress-so-far.md`** to point readers at this `HANDOFF.md`. Or merge / delete. **~30 min.**

### High user-facing impact (polish for Carol)

4. **Mobile responsiveness audit.** Her brief is mobile-first. Walk every page on a phone simulator, fix any breakpoint issues. Especially: property detail (with the wide sidebar grid), brochure generator, documents panel, photo upload flow. **~half day.**
5. **Pre-publish UI surfacing.** Currently you only discover what's missing when you click Publish and get an error. Move that check into the property-detail sidebar so it's visible without clicking. Reuses `lib/prepublish.ts` + `hasMandateDoc()`. **~2 hours.**
6. **Photo caption inline editing.** Currently captions can only be set at upload time (via the form). Allow inline edit on existing captions on the photo grid. State is already URL-keyed; just add an edit handler. **~2 hours.**
7. **Soft photo cap (12 max).** Friendly UI message when she hits the limit, prevents her from accidentally uploading 40 photos. Client-side check in `PropertyForm.uploadFiles()`. **~30 min.**
8. **Property form validation.** Negative prices, out-of-range coords (lat -90..90, lng -180..180), year-built sanity (1800..currentYear+1). Currently any value passes. **~2 hours.**

### Nice-to-have

9. **Dashboard widgets.** Pending approvals count tile, recent activity feed, property-status breakdown. The `/dashboard` page is sparse. **~half day.**
10. **Property list filters.** Add price range, multi-status, location filter. Currently just text search. **~3 hours.**
11. **Documents bulk download.** Zip all docs for a property in one click. Use JSZip on the client OR build it server-side. **~2 hours.**
12. **Anthropic prompt caching.** Wrap brochure system prompts in `cache_control: { type: "ephemeral" }`. Cuts brochure generation cost ~30% once she's generating dozens. **~1 hour.**
13. **HEIC upload smoke test.** iPhone default format. Verify the existing pipeline handles it; `sharp` supports it but worth a real test. **~30 min.**
14. **Per-page collapsible editor UI in BrochureEditor.tsx.** Currently a single "Generate" button. Could let her edit individual page slots (headlines, intros) inline before render. Nice-to-have; current "regenerate" workflow is cheap enough. **~half day.**

### Infra / quality

15. **Integration test suite.** Turn the chat-history smoke tests into a real `scripts/test-integration.ts` file so anyone can run them. Maintainable handoff. Should cover auth, property CRUD, idempotency under concurrency, role scoping, approval workflow, document upload/view/download/delete, brochure generation. **~half day.**
16. **Accessibility audit.** Keyboard navigation through forms, ARIA labels on icon-only buttons, color contrast check (the cream-on-cream theme is borderline). **~3 hours.**
17. **Image optimization in the photo grid.** Currently the form renders full-size images as thumbnails (the browser scales). Use `next/image` with `sizes` for proper srcset. **~2 hours.**

### Priorities if you only have a week

**My pick for the first sprint:** #1 (Puppeteer swap), #4 (mobile audit), #5 (pre-publish UI surfacing). Those are the highest-impact unblocked items. Everything else is incremental polish.

---

## 12 · Things that look weird but are intentional

- **No tests for routes.** Pure logic (reference numbers, prepublish checklist) has unit tests. Routes don't — they were validated by an extensive chat-history smoke suite that should become #15 above.
- **`@react-pdf/renderer` is still in `package.json` + `lib/brochure/template.tsx` exists.** Legacy prototype. The new Puppeteer path is in `pdf-v2`. Tear out per #2 above.
- **`/api/properties/[id]/brochure/draft` exists but is unused.** Same — legacy.
- **Two env flag names: `USE_DEV_DATA` (current) and `USE_DEV_USERS` (legacy).** Both read for one cycle; remove `USE_DEV_USERS` after next stable release.
- **Photos array `photos: string[]` mixes cover + gallery.** Index 0 is always the cover. There's no separate `coverPhoto` field. Was a deliberate simplification — one upload UI, one ordering control. Allocator handles slicing.
- **Feedback button writes commits to the repo** (for image attachments). They land on an orphan branch `feedback-attachments` so main stays clean. If this ever annoys you, swap to a third-party image host.
- **Brochure cap is 6 photos in the gallery** (not 5 or 7). Came from "let's allow one more photo" + "max 2 rows in the layout". Hard-coded as `GALLERY_MAX = 6` in `GalleryTemplateEditor.tsx`. Templates support up to 7 but the editor doesn't surface them — leftover from earlier iteration.
- **Cover photo gets a forest-green fallback when landscape.** This isn't a bug; it's the graceful degradation for legacy data where a landscape photo is the primary. The form blocks landscape from being primary going forward.
- **Mapbox token in `.env` is the default public one.** Fine for dev. For prod, restrict to the deployed domain OR generate a secret token.

---

## 13 · What I'd tell you over coffee

- The brochure system is the most over-iterated piece of this codebase. We rewrote the gallery editor about 4 times. The current row-masonry + template approach is the one that finally stopped having cropping bugs. **Don't replace it without understanding §3.4 (the math).**
- Carol pushes back on defaults. Most of the refinements (no-native-dialogs, sidebar callout for approvals, reset-not-set passwords, hard delete for users, multiple page-3 variants, the pull-quote on page 5) came from her feedback. Listen to it.
- The Owner-only delete checks are doubled up deliberately. Don't remove the explicit `if (user.role !== "owner")` even though `can()` already covers it. The brief says "ONLY the owner — never anyone else" — we want two independent checks because security regressions are silent.
- The whole project is one repo (`contract-ivy-devs`) but the public website is a separate repo (`kenya/sansiwebsite`). Don't confuse them. This back-office FEEDS the public website (eventually — Phase 2 territory). It is not itself public.
- The pay split is severely lopsided ($600 to us, $4–5k to the manager). Mentioned only because the next dev should know to protect their scope agreements in writing.

---

## 14 · Final words

If something in this doc is wrong, fix it. If something's missing, add it. This is a living handoff — the goal is that the next person reading it can be productive in a day.

Last meaningful changes summarized here: gallery template system + AI layout designer + page-3 variants + documents storage + feedback button + photo dimension capture + portrait-cover guard.

Whatever you ship: **commit and push it.** The repo is the handoff artifact. `git status` should be clean by EOD.
