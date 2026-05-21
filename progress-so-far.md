# Sansi Africa — Progress so far (handoff document)

A complete write-up of the project, the decisions, what's built, what's
partial, what's blocked, and what to pick up next. Written so a fresh dev
can clone the repo, read this end-to-end, and be productive within a day.

---

## 1. The client and the business problem

**Sansi Africa** is a brand-new luxury real-estate agency in Kenya. The
founder spent 14 years at Pam Golding (a major Kenyan firm), is repeatedly
recognised as one of the country's top luxury agents, and has just struck
out on her own. She has reputation but **no digital infrastructure** —
no website, no CRM, no admin system, no documented process.

Current state of her business (her own words):
- A whiteboard of sellers
- ~800–1,000 buyer contacts in her phone / head
- Inquiries arriving randomly via WhatsApp, email, Instagram DM, phone
- Nothing tracked. Leads slip. Properties she's been asked to sell sit
  in a notebook nobody else can see.

She has **no physical office**. The website will be her office. She runs
the entire business from her phone.

She also runs a tree-planting charity (donations + certificates) which is
hosted on the public website (already built).

She expects to grow her team within the first year:
- Herself (Owner / Founder)
- A personal assistant
- A General Manager (oversight)
- Several agents, one per Kenyan region (Nairobi, Kilifi, Lamu, Kwale, …)

The system has to support all four roles with different permissions.

---

## 2. Who's who

- **Aditya** (us / me) — the developer building this back-office system.
  Paid $600 total for the whole build.
- **Alex / Ishan (the "manager")** — the contractor who handed this work
  to us. **Non-technical.** He is paid $4–5k by the client. He acts as
  a relay between the client and us. He is not part of the dev work.
- **Carol Lees / Sansi** (the client) — the Kenyan founder.
- **A marketing consultant** — on a 3-month engagement to help her with
  brand direction, fonts, colour palette, business cards, etc. She is
  not building anything for us; we collaborate on brand assets only.

> **Money note for context.** The pay split here is severely lopsided.
> See chat history early on. The point for the next dev: the deliverable
> scope is large; protect your scope agreements in writing.

---

## 3. The full brief

The original brief lived at `~/Downloads/sansi-africa-build-brief.pdf`
(may not be in the repo). It defines **130 atomic features** across
**two phases**. We made `deliverables.md` (in this folder) which is the
authoritative list — read it now if you haven't.

The brief's two phases:

### Phase 1 — Website + Back-office workspace
- The public website (DONE — built by the manager; lives in
  `kenya/sansiwebsite/` as a separate Next.js project, its own git repo)
- The **back-office** for the team to manage everything (THIS IS US)
- Brochure generator (PDF, on-demand, ~half built — see §10)
- Certificate generator (PDF for tree donors, not started)

### Phase 2 — Lead management + automations
- Lead capture from website forms, email (`connect@sansi.africa`), and
  WhatsApp — all funnelled into Zoho CRM
- Smart routing to assigned agent + their assistant + founder
- AI-drafted replies in the founder's voice, approved by her via
  WhatsApp before sending (**never auto-sent**)
- 24-hour / 7-day follow-up reminders
- Mailing list (Zoho Campaigns) with segmentation
- Weekly Monday activity report email to the founder

---

## 4. Hard rules from the brief (NEVER violate these)

1. **Only the Owner (founder) can delete a property.** Everyone else is
   blocked, server-side, even if the UI ever exposed a button by accident.
   Enforced in `app/api/properties/[id]/route.ts` DELETE handler with an
   explicit `if (user.role !== "owner") return 403;` — not just `can()`.
2. **Private listings never appear in any public list or search.** Hidden
   from the website entirely; visible only to someone who enters the
   correct access code.
3. **Every sensitive-document access is logged.** Mandates / title deeds /
   deed plans must record who viewed/downloaded and when. (Implementation
   pending Step 3.)
4. **Nothing AI-generated is sent to a client automatically.** Brochures,
   AI-drafted email replies, AI follow-ups — all reviewed by a human first.
5. **The property reference number is the single source of truth.** Same
   `SA-YYYY-NNN` ID on the website, in the back office, on the brochure,
   in emails. Immutable once issued — never re-issued.
6. **Mobile-first.** She runs her business from her phone.

---

## 5. Stack & architectural decisions

### What we picked

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | Matches the public website's stack |
| Styling | **Tailwind 3** | Custom tokens in `tailwind.config.ts` + `app/globals.css` (CSS vars) |
| Auth | **Custom JWT (`jose`) + `bcryptjs` + httpOnly cookie** | Not Supabase Auth — keeps the auth layer simple and portable |
| Database | **Supabase (Postgres + Storage)** | Swapped from Sanity mid-build (see §6) |
| Object storage | **Supabase Storage** (same bucket for photos + sensitive docs) | Replaces the original R2/S3 plan |
| AI | **Anthropic Claude (`claude-sonnet-4-5`)** | Used for brochure copy + (eventually) Phase 2 reply drafts |
| WhatsApp | **WhatsApp Business Cloud API** via Meta | Long lead time — see §9 |
| Email | **Zoho Mail / CRM / Campaigns** | All under client's account; Phase 2 |
| PDF rendering | **Open** — currently using `@react-pdf/renderer` for an in-progress prototype, planning to switch to Puppeteer (see §10) | |
| Image upload | Local FS in dev (`public/uploads/`), Supabase Storage in prod | Adapter pattern, env-toggled |

### Why custom auth, not Supabase Auth

- Less rewrite on the existing routes (already had middleware, role checks,
  cookie helpers). 
- Easier handoff (no Supabase Auth quirks for the next dev to learn).
- Role enforcement happens in `lib/roles.ts` + `lib/guard.ts`, totally
  independent of where users are stored.

### The env-flag pattern (very important)

**`USE_DEV_DATA=true` (default in `.env.local`)** switches the app to its
fully self-contained dev mode:
- Users come from `lib/devUsers.ts` (4 seed accounts, hard-coded)
- Properties + Users persist to `.devdata/*.json` (gitignored)
- Photo uploads land in `public/uploads/` (gitignored)
- **No cloud accounts needed for development.**

**`USE_DEV_DATA=false`** switches to Supabase Postgres + Supabase Storage.
Read by `lib/devUsers.ts` and propagated through:
- `lib/repo/properties.ts`
- `lib/repo/users.ts`
- `lib/storage.ts`

A legacy alias `USE_DEV_USERS=true` is honoured for one cycle. Drop it
later.

---

## 6. The Sanity → Supabase switch (mid-build)

The brief originally recommended **Sanity CMS**. We coded toward Sanity for
several days (schemas in `sanity/schemas/`, GROQ queries in repo backends),
**never actually testing against a real Sanity project** — the dev-data
JSON backend was the only one exercised.

Mid-build, the user (the dev) flagged that Supabase is their daily driver
and Sanity's editing UI advantage was wasted because we built our own
admin UI. We agreed to swap.

The swap (one commit's worth of work) included:
- Deleted `sanity/schemas/` (6 files) + `lib/sanity.ts`
- Removed `@sanity/client`, added `@supabase/supabase-js`
- Wrote `lib/supabase.ts` (server-only client)
- Wrote `migrations/001_init.sql` — full Postgres schema
- Rewrote the `else` branches in `lib/repo/properties.ts` and
  `lib/repo/users.ts` to use Supabase (with snake_case ↔ camelCase mapping
  at the boundary)
- `lib/storage.ts` branches on `usingDevData` — local FS vs Supabase Storage
- `next.config.js` `remotePatterns` updated to `**.supabase.co`
- `.env.example` rewritten (was `SANITY_*` → now `SUPABASE_*`)
- `needs.md` updated

**Caveat: the Supabase production branch is typechecked but has NOT been
run against a live Supabase project.** No Supabase project has been
provisioned yet. The first deploy IS the integration test. Track this
as deliverable #123 (still 🟡).

A second migration `migrations/002_brochure_fields.sql` was added later
for facing direction + plot dimensions + brochure toggles. Apply both
files in order.

---

## 7. The 4-role permission system

**Single source of truth: `lib/roles.ts`** — a TypeScript object literal.
Every server route reads from it via `lib/guard.ts` or directly.

| Capability | Owner | Assistant | GM | Agent |
|---|---|---|---|---|
| viewProperties | all | all | all | own |
| createProperty | ✅ | ✅ | ❌ | ✅ (own) |
| editProperty | all | all | ❌ | own |
| **deleteProperty** | ✅ | ❌ | ❌ | ❌ |
| publishToWebsite | all | all | ❌ | own |
| viewDocuments | all | all | all | own |
| viewInquiries | all | all | all | own |
| viewReports | ✅ | ✅ | ✅ | ❌ |
| manageUsers | ✅ | ❌ | ❌ | ❌ |
| generateBrochure | ✅ | ✅ | ✅ | ❌ |

GM is mostly read-only. The one "write-ish" thing GM can do is
`generateBrochure` (it creates an output file but mutates no records).

`can(role, capability, { isOwnerOfRecord })` is the single function every
route calls.

---

## 8. The approval workflow

Properties added by Assistants or Agents enter a queue; the Owner reviews
and approves before they can be published to the public website.

States: `pending` · `approved` · `changes_requested`.

Rules (decided in chat with the user):
- Owner-created property → auto `approved`
- Non-Owner-created → `pending`
- Owner edit of an approved property → **stays approved**
- Non-Owner edit of any property → **resets to pending**
- Publish-to-website blocked unless `approval === "approved"` (in addition
  to the existing pre-publish checklist)
- `/approvals` page (Owner-only) shows the queue
- Dashboard sidebar callout shows pending count for Owner

Routes:
- `POST /api/properties/[id]/approve` — Owner-only
- `POST /api/properties/[id]/request-changes` — Owner-only, requires `note`
- Generic `PATCH /api/properties/[id]` strips any `approval` / 
  `changesRequestedNote` from the body — those only change via dedicated
  endpoints.

---

## 9. What's needed from the client / manager (blockers)

**The full canonical list is `needs.md`** in this folder. Quick summary:

### Accounts she must create under her own identity + billing
- **Anthropic Claude API key** ✅ ADDED by the dev to `.env`
- **Supabase project** (Postgres + Storage) — NOT YET
- **Zoho** account (CRM + Mail + Campaigns) — NOT YET. CRM is free tier.
  Zoho Mail is paid (~$1/user/month) and needs DNS verification on
  `sansi.africa` domain.
- **Meta Business** account + verification — NOT YET. **Longest lead time
  on the entire project** (1–3 weeks of review). Required for WhatsApp
  Cloud API. *Start this immediately, even though the WhatsApp code
  won't be written for weeks.*
- **M-Pesa Paybill** number (donation page display only — no payment
  processing on our end)

### Brand assets needed
- **Logo** — exists in `kenya/netlify/assets/sansi-logo.jpg`. Needs to be
  copied to `backoffice/public/sansi-logo.jpg` so the brochure cover
  picks it up. Has not been done yet.
- **Brochure design template** — reference brochure exists at
  `kenya/netlify/index.html` (and the stripped version at
  `kenya/netlify/stripped-brochure.html`). See §10.
- **Awards & recognitions** — final list + logos for the "Luxury Lifestyle
  Real Estate Award" mention
- **3–5 examples of her own writing voice** — for the AI to mimic in
  Phase 2 lead replies AND in brochure copy (currently we're using
  the reference brochure as the only voice sample)
- **Tree-planting certificate design** (logo, signature, layout)

### Property content for go-live seed
- Initial property data, photos, floor plans, signed mandate documents,
  title deeds, deed plans for whichever listings she wants live on day one

### Open decisions still pending
- Final list of regions for the property filter
- Access-code format (per property? per region? what shape?)
- Membership applications — auto-accepted or owner-reviewed?
- How long to retain documents on sold/inactive properties
- The external URL for the "Property Management" link (her friend's
  separate company)
- Brochure template design final sign-off

### Important account-ownership rule
**Every account above is created under HER email and HER billing.** We get
*access* (API keys, OAuth tokens, admin invites). We never create her
business accounts under our personal identities. This protects her in
case the dev relationship ends.

---

## 10. The brochure generator (current sprint)

**Status: in flight.** This is the most active piece of work as of the
handoff point.

### What she wants

From her meeting with the manager (full transcript pasted into the chat
on 2026-05-21):
- A **"Create brochure"** button on each property detail page
- One click → **polished PDF** generated from the property data + photos
- **No need for the property to be published** — she wants to generate
  brochures for unpublished/private listings too, so she can pre-send to
  shortlisted buyers
- The PDF downloads to her local machine (Google Drive / Dropbox); we
  don't store it server-side
- **Brand uniformity** — replaces a 2–3 day designer task. No more Canva
  on the side.
- The design should match the website's editorial voice (Cormorant
  Garamond + ivory/gold palette)
- **Optional sections per property:**
  - Map location — can be hidden when the seller wants location withheld
  - Plot diagram — only meaningful for plots with dimensions (not apartments)

### What we've built so far

**Permission added.** `generateBrochure: true` for Owner, Assistant, GM;
`false` for Agent (per client decision).

**Form fields added** (already shipped, see `migrations/002_brochure_fields.sql`):
- `facingDirection` (N / NE / E / SE / S / SW / W / NW)
- `plotWidthMeters` and `plotLengthMeters` (numerics, for drawing the
  plot diagram)
- `showMapOnBrochure` (boolean, default true)
- `showPlotOnBrochure` (boolean, default true)
- Amenities chip list expanded with: Inverter, Fireplace, Wine cellar,
  Reception room, Guest house

**The first generator (a prototype, will likely be replaced):**

We built a `@react-pdf/renderer` implementation:
- `lib/brochure/types.ts` — slot type definitions (8 slots)
- `lib/brochure/prompt.ts` — Claude system prompt + few-shot examples
- `lib/brochure/claude.ts` — Anthropic SDK wrapper (tool-use, low temp)
- `lib/brochure/template.tsx` — full PDF template, 7 pages, hand-ported
  from the reference design
- `app/api/properties/[id]/brochure/draft/route.ts` — Claude → slots JSON
- `app/api/properties/[id]/brochure/pdf/route.ts` — slots + property →
  streamed PDF download
- `app/properties/[id]/brochure/page.tsx` — preview/edit UI
- `components/BrochureEditor.tsx` — client-side editor for the 8 slots
- "Create brochure" button wired into `components/PropertyControls.tsx`

End-to-end smoke test passed. Claude produces good editorial copy.
PDF renders (~16 KB, valid `%PDF`).

**The catch:** the user looked at the rendered PDF and decided the visual
fidelity to the reference brochure was insufficient. Fonts in particular —
we couldn't find working Google Fonts CDN URLs for Cormorant Garamond /
JetBrains Mono static TTFs, so we fell back to react-pdf's built-in
`Times-Roman` + `Courier`. Lost the editorial flavour.

### The pivot: HTML template + Puppeteer

We agreed to swap the rendering pipeline to **HTML-string-template +
Puppeteer (or similar)**. The reference HTML becomes the literal
template — no re-implementation in `@react-pdf` components.

Why: the reference brochure at `kenya/netlify/index.html` is a
**designer-built 6-page brochure** with full Cormorant Garamond fonts
loaded via Google Fonts, real SVG site plan, photo grid, custom
typography for every section. Re-implementing it in `@react-pdf` loses
fidelity.

### What's been done toward the pivot

- `kenya/netlify/stripped-brochure.html` — the reference HTML with:
  - React/Babel/`tweaks-panel.jsx` scripts removed
  - `data-screen-label` attributes removed
  - **~15 slot positions** templated with `{{handlebars}}` markers:
    - `{{title}}`, `{{referenceNumber}}`, `{{location}}`, `{{price}}`,
      `{{coverDate}}`, `{{coverEyebrow}}`, `{{coverTitle}}`,
      `{{coverTagline}}`
    - `{{glanceHeadline}}`, `{{glanceSubhead}}`, `{{keyFactsLabel}}`
    - `{{locationHeadline}}`, `{{landHeadline}}`, `{{featureHeadline}}`,
      `{{closingHeadline}}`
- The rest of the property-specific content (body paragraphs, the
  key-facts list items, the price-row labels, the locality map SVG with
  hardcoded Karura Forest, the site-plan SVG with hardcoded plot
  dimensions) **still has Rosslyn-specific demo data baked in.**

### What's left to do for the brochure

1. **Finish templating `stripped-brochure.html`:**
   - Body paragraphs (intro blurb, "shortest description", location
     intro, gallery intro, terms text, disclaim)
   - The `keylist` items (Location / Tenure / Size / Shape / Use / Status
     / Sale)
   - The price-row block + the four facts (Total area / Configuration /
     Frontage / Tenure)
   - The locality-map SVG — make positions / labels driven by data
     (currently hardcoded to Karura / UN / Gigiri); or replace with a
     real map embed
   - The site-plan SVG — recompute polygon points from
     `plotWidthMeters × plotLengthMeters`
   - Per-page eyebrows (`§ I — At a Glance` etc.) — keep static or
     templatise
   - Photo `src` attributes — wire to property's `photos[]` array
   - `assets/sansi-logo.jpg` reference — move logo into `public/`
2. **Install Puppeteer:**
   - For dev: `puppeteer` (auto-downloads Chromium)
   - For Vercel production: switch to `puppeteer-core` +
     `@sparticuz/chromium`
3. **Replace `app/api/properties/[id]/brochure/pdf/route.ts`** so it:
   - Reads the templated HTML from disk
   - Replaces `{{slot}}` placeholders with property data + Claude slots
   - Launches headless Chromium
   - Sets page format A4
   - Renders to PDF, streams back
4. **Expand the `BrochureSlots` interface** (`lib/brochure/types.ts`) to
   match the full set of `{{slot}}` positions in the templated HTML.
5. **Update `lib/brochure/prompt.ts`** so Claude knows about all the new
   slots and fills them on-tone.
6. **Decide whether `@react-pdf/renderer` stays** as a fallback or gets
   torn out. (Recommendation: tear out once Puppeteer works — one
   pipeline is simpler.)

### Where the assets are

- Reference brochure (untouched): `kenya/netlify/index.html`
- Stripped + partially templated: `kenya/netlify/stripped-brochure.html`
- Property photos (5 large JPGs): `kenya/netlify/assets/gallery-*.jpg`,
  `hero.jpg`
- Sansi logo: `kenya/netlify/assets/sansi-logo.jpg` (needs to be moved
  into `backoffice/public/sansi-logo.jpg`)
- Original zip from the client: `kenya/Carol Lees.zip` (~31 MB — can be
  deleted)

### Latest direction: per-page template architecture (May 21 onward)

The newest architectural decision — adopted after looking at the size and
complexity of `stripped-brochure.html` — is to **split the brochure into
six separate per-page templates** instead of one monolithic file.

This SUPERSEDES the "templatise the single stripped HTML file" plan
described above. Treat the earlier "What's left to do for the brochure"
list as historical context; the revised plan is at the end of this
subsection.

#### What this means

Instead of one 945-line file holding all six pages, we'd have:

```
templates/brochure/
├── _shared.css              shared design tokens, fonts, type scale
├── 01-cover.html
├── 02-at-a-glance.html
├── 03-location.html
├── 04-site-plan.html
├── 05-feature.html         (or 05-gallery, depending on property type)
└── 06-terms-and-contact.html
```

Each file is a self-contained A4-sized HTML snippet that imports the
shared CSS. No file knows about the others.

#### Why this is better

1. **Easier to fill.** Each template has 2–5 slots, not ~15. Smaller,
   more focused replacement step. Cleaner mental model when reading
   the code or debugging output.
2. **Less error scope.** A CSS bug on page 4 can't push page 2 around.
   A Claude hallucination in the feature page can't bleed into the cover.
3. **Per-property variability becomes natural.** The render pipeline
   picks WHICH templates to include based on the property's data:
   - Land/plots: keep `04-site-plan`, drop house-only content
   - Apartments: drop `04-site-plan`, emphasise built area + amenities
   - Restored heritage homes: add an extra "the restoration" page
   - Beachfront homes: a "the setting" feature page with ocean imagery
4. **Designers and devs can iterate page-by-page.** Fix the closing
   page's disclaimer overflow without re-validating that the cover
   still renders correctly. Marketing person can hand back one
   page's `.html` for review without us regenerating the entire deck.
5. **Slot prompts to Claude become per-page.** Smaller scope, sharper
   few-shot examples, lower token budget per call. A targeted "fill
   the cover" prompt with 4 slots returns faster and is easier to
   evaluate than one 15-slot mega-prompt.
6. **Caching potential.** Pages that didn't change between regenerations
   (e.g. the static "process & terms" block) can be cached and
   skipped — only the data/AI-driven pages re-render.
7. **Failures degrade gracefully.** If Claude misfires on the feature
   page, we can re-draft just that page from the preview UI without
   resetting the other five.

#### How the pipeline changes

Old plan:
```
property + 1 big slot set → 1 templated HTML → Puppeteer → 1 PDF
```

New plan:
```
property data
   ↓
For each page in [01..06]:
   ├── page-selection rule (e.g. skip 04-site-plan if apartment)
   ├── Claude fills that page's slots only
   └── render that page's HTML with the filled slots
   ↓
Concatenate all included pages into one master HTML
   ↓
Puppeteer → PDF
   ↓
Stream to browser
```

Each step is small, isolated, inspectable, and individually retry-able.

#### Code shape after this pivot

`lib/brochure/types.ts` splits into per-page types:

```ts
// lib/brochure/types.ts
export interface CoverSlots {
  coverEyebrow: string;
  coverTitle: string;        // can be a 2-line break with <em>
  coverTagline: string;
}
export interface GlanceSlots {
  headline: string;
  subhead: string;
  blurb: string;
}
export interface LocationSlots {
  headline: string;
  intro: string;
}
export interface SitePlanSlots {
  headline: string;
}
export interface FeatureSlots {
  headline: string;
  body: string;
}
export interface ClosingSlots {
  headline: string;
  termsPreamble: string;
}

export interface BrochureSlots {
  cover: CoverSlots;
  glance: GlanceSlots;
  location: LocationSlots;
  sitePlan?: SitePlanSlots;   // optional based on data
  feature: FeatureSlots;
  closing: ClosingSlots;
}
```

Claude prompts get one file per page (`lib/brochure/prompts/cover.ts`,
`lib/brochure/prompts/glance.ts`, …). Each file has:
- A page-specific system prompt
- 1–2 page-specific few-shot examples pulled from the reference brochure
- A page-specific tool schema

A new `lib/brochure/pages.ts` defines the page-selection rules:

```ts
export type PageId = "cover" | "glance" | "location" | "sitePlan" | "feature" | "closing";

export function pagesFor(p: PropertyRecord): PageId[] {
  const out: PageId[] = ["cover", "glance"];
  if (p.city) out.push("location");
  if (p.showPlotOnBrochure !== false && p.plotWidthMeters && p.plotLengthMeters) {
    out.push("sitePlan");
  }
  out.push("feature", "closing");
  return out;
}
```

A new `lib/brochure/assembler.ts` does the final glue:

```ts
// Given a property + all per-page slots, returns the final concatenated
// HTML ready for Puppeteer. Reads each page template from
// templates/brochure/<id>.html, replaces {{slot}} placeholders, joins
// them with <div class="page-break"></div>.
export async function assembleBrochure(
  p: PropertyRecord,
  allSlots: BrochureSlots
): Promise<string> { … }
```

`lib/brochure/claude.ts` exposes one function per page:

```ts
export async function draftCoverCopy(p): Promise<CoverSlots> { … }
export async function draftGlanceCopy(p): Promise<GlanceSlots> { … }
// …
```

`app/api/properties/[id]/brochure/draft/route.ts` becomes:
- `POST /api/properties/[id]/brochure/draft` — runs ALL pages
- `POST /api/properties/[id]/brochure/draft?page=cover` — runs just one page
  (so the UI can offer "re-draft this page")

The PDF route stays a single endpoint that calls the assembler then
hands the HTML to Puppeteer.

#### Preview/edit UI after this pivot

`/properties/[id]/brochure` becomes a multi-section editor:

```
▾ Cover               [re-draft this page]
   Eyebrow:   [______________________]
   Title:     [______________________]
   Tagline:   [______________________]

▾ At a glance         [re-draft this page]
   Headline:  [______________________]
   ...

▾ Site plan           [auto-skipped — no plot dimensions]
                       (not editable; greyed out)

...

[ Download PDF ]
```

Each section is collapsible. Each section shows its own "re-draft"
button. Skipped pages render as greyed cards with a note explaining
why (e.g. "Skipped: this is an apartment, no plot diagram applies").

#### Revised "what's left to do for the brochure"

The earlier 6-step plan in this section is replaced with:

1. Create `templates/brochure/` directory + 6 per-page HTML files + a
   shared `_shared.css`. Extract each page out of `stripped-brochure.html`.
2. Define the slot inventory per page; codify in
   `lib/brochure/types.ts`.
3. Write one Claude prompt module per page in
   `lib/brochure/prompts/*`, each with its own tool schema and
   page-specific few-shots from the reference.
4. Implement `lib/brochure/pages.ts` (page-selection rules) and
   `lib/brochure/assembler.ts` (HTML assembly + slot interpolation).
5. Update `lib/brochure/claude.ts` to expose per-page draft functions.
6. Install Puppeteer (`puppeteer` for local; `puppeteer-core` +
   `@sparticuz/chromium` for Vercel / serverless).
7. Replace `app/api/properties/[id]/brochure/pdf/route.ts` with the
   assembler + Puppeteer pipeline.
8. Update `app/api/properties/[id]/brochure/draft/route.ts` to support
   `?page=<id>` for per-page re-drafts.
9. Rewrite `components/BrochureEditor.tsx` as the per-page collapsible
   editor described above.
10. Remove the `@react-pdf/renderer` template
    (`lib/brochure/template.tsx`) once Puppeteer-driven brochures are
    working end-to-end. One pipeline is simpler than two.

#### Things to be careful of with this architecture

- **Typography consistency across pages.** Each page imports
  `_shared.css` — don't let individual page files override fonts or
  colors unless intentional. Centralise design tokens.
- **Page-break behaviour.** Each page template should end with
  `<div style="page-break-after: always;"></div>` (or the assembler
  inserts it). Use Puppeteer's `@page { size: A4; margin: 0; }` CSS
  to lock the page format.
- **Shared running header / footer.** Two options: either include them
  inside each page template (simple but redundant), or use Puppeteer's
  `headerTemplate` / `footerTemplate` options at PDF generation time
  (DRY but Puppeteer's header HTML has size limits and font weirdness).
  Recommend: in-template until you hit a maintenance pain point.
- **The site-plan SVG.** Still needs polygon recomputation from
  `plotWidthMeters × plotLengthMeters`. Belongs ONLY in
  `04-site-plan.html`. Drive the polygon points + dimension labels
  from data, not hardcoded.
- **Photo URLs.** In dev the URLs are `/uploads/...` (same-origin).
  In prod they're Supabase Storage public URLs. Puppeteer will load
  both fine, but ensure the dev server is reachable from wherever
  Puppeteer is running (loopback fine on local, more careful on
  serverless — may need to inline images as data URIs in production
  if the Puppeteer Lambda can't reach localhost).
- **One Claude API call per page** means ~6 calls per brochure. With
  Claude Sonnet 4.5 latency that's ~30–60 seconds total if sequential,
  ~10 seconds if parallelised. **Parallelise** — `Promise.all` across
  the included pages. The preview UI should be designed to handle that
  wait (skeletons, "drafting cover…" / "drafting feature…" indicators).

---

## 11. Where everything lives (file map)

```
kenya/                          NOT a git repo (intentionally)
├── sansiwebsite/               public website (separate repo, manager-built)
├── netlify/                    brochure reference assets from client zip
│   ├── index.html              the reference brochure (do not edit)
│   ├── stripped-brochure.html  the working template (in progress)
│   └── assets/
│       ├── sansi-logo.jpg      *** move to backoffice/public/
│       ├── hero.jpg
│       └── gallery-*.jpg
├── Carol Lees.zip              original zip from client (can be deleted)
└── backoffice/                 ★ this repo — git, pushed to GitHub ★
    ├── README.md               run-it-locally guide
    ├── deliverables.md         all 130 atomic features + status markers
    ├── needs.md                what's blocked on client/manager input
    ├── progress-so-far.md      THIS FILE
    ├── .env                    contains ANTHROPIC_API_KEY (gitignored)
    ├── .env.local              AUTH_SECRET + USE_DEV_DATA=true (gitignored)
    ├── .env.example            template; safe to commit
    ├── migrations/
    │   ├── 001_init.sql        full Postgres schema
    │   ├── 002_brochure_fields.sql
    │   └── README.md           how to apply migrations
    ├── lib/
    │   ├── roles.ts            ★ single source of truth for RBAC ★
    │   ├── auth.ts             JWT session helpers (jose + cookie)
    │   ├── guard.ts            auth+permission gate for API routes
    │   ├── devUsers.ts         the 4 seeded dev users + USE_DEV_DATA flag
    │   ├── referenceNumber.ts  SA-YYYY-NNN generator (pure, tested)
    │   ├── prepublish.ts       pre-publish checklist (pure, tested)
    │   ├── format.ts           KES currency formatter
    │   ├── relative.ts         relative-time formatter
    │   ├── supabase.ts         server-only Supabase client (service role)
    │   ├── storage.ts          file upload — local FS in dev, Supabase in prod
    │   ├── repo/
    │   │   ├── properties.ts   data layer for properties (dev JSON or Supabase)
    │   │   ├── users.ts        data layer for users (with seed-shadowing)
    │   │   └── documents.ts    stub for Step 3 (mandate access logging)
    │   └── brochure/
    │       ├── types.ts        BrochureSlots interface (8 slots)
    │       ├── prompt.ts       Claude system prompt + few-shots
    │       ├── claude.ts       Anthropic SDK wrapper (tool-use)
    │       └── template.tsx    @react-pdf/renderer template (TO BE REPLACED)
    ├── app/
    │   ├── login/page.tsx
    │   ├── dashboard/page.tsx
    │   ├── profile/page.tsx
    │   ├── properties/
    │   │   ├── page.tsx
    │   │   ├── new/page.tsx
    │   │   ├── [id]/page.tsx
    │   │   └── [id]/brochure/page.tsx     brochure preview/edit
    │   ├── team/                          Owner-only user mgmt
    │   │   ├── page.tsx                   list, grouped Owner/Mgmt/Agents
    │   │   ├── new/page.tsx
    │   │   └── [id]/page.tsx              edit + reset + deactivate + delete
    │   ├── approvals/page.tsx             Owner-only pending queue
    │   └── api/
    │       ├── auth/
    │       │   ├── login/route.ts
    │       │   └── logout/route.ts
    │       ├── profile/
    │       │   ├── route.ts               GET / PATCH self
    │       │   └── password/route.ts      change own password
    │       ├── users/
    │       │   ├── route.ts                          GET list, POST create
    │       │   ├── [id]/route.ts                     GET PATCH DELETE
    │       │   ├── [id]/deactivate/route.ts          POST toggle active
    │       │   └── [id]/reset-password/route.ts      POST temp pw
    │       ├── agents/route.ts            list active agents for the picker
    │       ├── upload/route.ts            image upload (auth'd)
    │       └── properties/
    │           ├── route.ts                          GET list, POST create
    │           ├── [id]/route.ts                     GET PATCH DELETE
    │           ├── [id]/status/route.ts              POST change status
    │           ├── [id]/visibility/route.ts          POST private+code toggle
    │           ├── [id]/publish/route.ts             POST publish-to-website
    │           ├── [id]/approve/route.ts             POST Owner approve
    │           ├── [id]/request-changes/route.ts     POST Owner reject w/ note
    │           ├── [id]/brochure/draft/route.ts      POST Claude → slots
    │           └── [id]/brochure/pdf/route.ts        POST slots → PDF download
    ├── components/
    │   ├── Header.tsx              site-wide header (Home / Profile / Sign out)
    │   ├── PropertyForm.tsx        create/edit form (long)
    │   ├── PropertyControls.tsx    detail sidebar (status / approve / publish / brochure / delete)
    │   ├── UserForm.tsx
    │   ├── ProfileForms.tsx
    │   ├── BrochureEditor.tsx
    │   ├── ChipInput.tsx           tag/chip input (highlights, amenities)
    │   ├── ModalShell.tsx          themed confirm/prompt modal (no native dialogs)
    │   ├── DeleteUserButton.tsx
    │   ├── DeactivateButton.tsx
    │   ├── ResetPasswordButton.tsx
    │   ├── StatusBadge.tsx
    │   ├── ApprovalBadge.tsx
    │   └── WebsiteBadge.tsx
    ├── middleware.ts               route guard (bounces unauth to /login)
    └── scripts/
        └── test-logic.ts           12 pure-logic unit tests
```

---

## 12. What's built and tested (✅) — by deliverable number

(`deliverables.md` is canonical and per-deliverable. Cross-reference there
for the full mapping.)

### Auth & access
- ✅ #1 Login (real bcrypt + JWT cookie)
- ✅ #2 Logout
- ✅ #5 Stay logged in (7-day session)
- ✅ #6 Create user (Owner only)
- ✅ #7 Edit user
- ✅ #8 Deactivate user (soft, reversible)
- ✅ #9 Assign role to user
- ✅ #10 Role-based access enforcement (everywhere)
- ✅ #11–#14 All four role definitions

(#3 Forgot password and #4 Reset password are unbuilt — they need email,
which needs Zoho Mail wired up. See `progress-so-far.md` §10 for the
intermediate `Reset password` admin flow we do have.)

### Back-office shell
- ✅ #15 Dashboard (role-aware, side-panel for Owner approval queue)
- 🟡 #16 Mobile responsive (the pages we built are; not exhaustive yet)
- ✅ #17 Navigation (Header component everywhere)

### Property management
- ✅ #18 Create
- ✅ #19 Edit
- ✅ #20 View detail
- ✅ #21 List (filterable)
- ✅ #22 Auto reference number `SA-YYYY-NNN` (immutable)
- ✅ #23 City + Country (split from "region")
- ✅ #24 Price (KES, comma-grouped input)
- ✅ #25 Bedrooms · #26 Bathrooms
- ✅ #27 Plot size (land) · added Built area (house) as a sibling
- ✅ #28 Property type
- ✅ #29 Description + Highlights chips + Amenities chips + Nearby places
- ✅ #31 Photo upload (real upload, multi-select, reorder, primary picker)
  (was 🟡 with URLs, upgraded mid-build)
- ✅ #35 Assign agent (real dropdown sourced from active agents)
- ✅ #37–#41 Status (Draft / Active / Sold / Rented + transitions)
- ✅ #42 Sold/Rented banner signal
- ✅ #43–#46 Public/private toggle + access code
- ✅ #47 Owner-only delete · #48 Non-owner blocked · #49 Record persists
  when hidden
- ✅ #50 Filter/search
- ✅ #51 Agent sees only own
- Unbuilt: #30 Map location, #32 Photo gallery management UI, #33 Set
  primary photo (we do have a primary-picker but it's not surfaced as a
  separate deliverable), #34 Upload floor plan, #36 Link property to
  seller contact

### Pre-publish checklist (#52–#62)
- ✅ All implemented and gating publish
- 🟡 #59 (mandate uploaded) is the seam — currently
  `lib/repo/documents.hasMandateDoc()` always returns false. When Step 3
  (document storage) lands, the real value flows through automatically.

### Approval workflow
- ✅ pending / approved / changes_requested states (+ note)
- ✅ Auto-pending on non-Owner create or edit
- ✅ Stays approved when Owner edits
- ✅ Publish blocked unless approved
- ✅ Owner-only dashboard side-panel + `/approvals` queue page
- ✅ Approve and Request-changes buttons on the property detail
- (These items aren't in the original 130; they're an addition from the
  client meeting on May 20.)

### Team & roles (#6–#9 + dedicated UI)
- ✅ List grouped by tier (Owner / Management / Agents)
- ✅ Invite member
- ✅ Edit fields (Owner cannot type new passwords; uses Reset Password
  instead — security best practice)
- ✅ Reset password → one-time temp pass shown once + must-change-on-next-login banner
- ✅ Self-service `/profile` page (name / email / change own password)
- ✅ Deactivate (soft)
- ✅ Hard delete (Owner only, with orphan-properties guard)
- ✅ Last sign-in timestamp tracked + displayed

### Infrastructure
- ✅ #120 Next.js app set up
- ✅ #122 GitHub repo (https://github.com/Aditya-Dhodapkar/contract-ivy-devs)
- ✅ #125 Anthropic Claude API integration (for brochure)
- 🟡 #123 Database — Supabase code path written, never run against a live
  project
- 🟡 #124 Document storage — using Supabase Storage in code; needs Step 3
  for the upload/log UI
- Unbuilt: #121 Vercel hosting (no deploy yet), #126–#130 (Zoho + Meta —
  all blocked on the client provisioning her accounts)

### Pure-logic tests
- ✅ 12/12 in `scripts/test-logic.ts`
- Cover: reference-number generation (per-year sequencing, padding,
  uniqueness, validator); pre-publish checklist (per-field, house-only
  bed/bath rule, all-present pass)
- Run with: `node --experimental-strip-types scripts/test-logic.ts`

### Integration smoke tests
- We've maintained a Node-based curl/fetch suite throughout the build.
  Last green run covered 21 scenarios across auth, property CRUD,
  idempotency under concurrency, GM read-only, agent scoping, approval
  workflow, delete rules, user CRUD, dup-email, password reset,
  deactivate, last-login tracking.
- Not committed as a file yet (lives in chat history). **Should be turned
  into a test file** for the next dev — see §15 next steps.

---

## 13. UX / design notes (so you don't undo things on purpose)

These are decisions made in chat with the user, often after the user
pushed back on a default:

- **The whole back-office uses the public site's typography & palette**
  (Cormorant Garamond + Mulish, ivory/gold/ink). Defined in
  `tailwind.config.ts` + CSS vars in `app/globals.css`.
- **No native browser dialogs.** All confirm/prompts use `ModalShell`.
- **Currency stored as KES numeric, displayed as "Ksh 1,234,567" via
  `lib/format.ts` `formatKes()`. The price input has comma grouping live
  (no per-keystroke caret-preserve, but acceptable).
- **The Owner cannot directly set another user's password.** Only Reset
  (which produces a temp shown once). Self password change requires
  current password. This was a deliberate security review change midway
  through the build.
- **The dashboard pending-approval count is on a sidebar callout, not
  mixed into the main tile list.** Owner-only, hidden when count is zero.
- **Property list rows show 3 badges**: Approval (gold/green/red) +
  Status (draft/active/sold/rented) + Website (Live / Not live).
- **All photo URLs are stored in `photos: string[]`** with index 0 = primary.
  The form UI has ★/← →/✕ controls.
- **Year built + Year restored** are real fields (originally not in the
  brief; added per client meeting).
- **Nearby places** is a structured `{ place, distance }[]` repeater
  (originally a freeform textarea; restructured per user feedback).
- **Country defaults to "Kenya" but is editable** so she can list outside
  Kenya if she ever does.
- **"Dev seed" users** (owner/assistant/gm/agent@test.com / `password`)
  are editable + deactivatable + login-with-temp-password-able. They're
  there so anyone can boot the system without the Supabase database. In
  production they don't load (`USE_DEV_DATA=false`).

---

## 14. Things to NOT touch / undo

- `lib/roles.ts` capability set & matrix. Read-only at runtime; any change
  here ripples through every API route. If you adjust it, **update the
  table in §7 above** so the next reader doesn't get confused.
- The Owner-only delete checks in property + user routes (both `can()` AND
  an explicit `if (user.role !== "owner")` belt-and-braces).
- Reference numbers are immutable. The repo strips `referenceNumber` from
  any patch body.
- Approval state is set ONLY via `/approve` and `/request-changes`. The
  generic PATCH strips it.
- `USE_DEV_DATA` env flag — don't remove the back-compat read of
  `USE_DEV_USERS`; you'd break running `.env.local` files in flight.

---

## 15. Recommended next steps (in priority order)

1. **Finish the brochure pivot** (HTML template + Puppeteer). See §10.
   This is mid-flight; most-recent slice of work.
2. **Move `sansi-logo.jpg` into `backoffice/public/`** — currently the
   brochure cover renders without a logo because the file is in
   `kenya/netlify/assets/`, not in the repo.
3. **Provision Supabase** under the client's account. Apply
   `migrations/001_init.sql` and `migrations/002_brochure_fields.sql`.
   Create a storage bucket `property-photos` (or whatever you set
   `SUPABASE_STORAGE_BUCKET` to). Confirm the live Supabase branch works
   end-to-end (this is the first real test of that code path). Mark #123
   ✅ once done.
4. **Set up Vercel hosting** (#121). Deploy. Confirm the prod build works
   against the real Supabase project.
5. **Step 3 — Document storage (#63–#71).** Mandate / title deed / deed
   plan upload, secure storage in the same Supabase bucket (different
   prefix), immutable access log. Wires up `lib/repo/documents.ts`
   (currently a stub). Once done, the pre-publish checklist's mandate
   gate (#59) flips from 🟡 to ✅ automatically — no other code change.
6. **Step 4 — Certificate generator (#76–#78).** Reuse the Puppeteer
   pipeline from the brochure work. Simple template.
7. **Push the integration smoke suite into a real file** (e.g.
   `scripts/test-integration.ts`) so the next dev can run it locally and
   in CI. Currently it lives in chat history; not great.
8. **Once she finishes Meta verification + Zoho setup, kick off Phase 2.**
   Lead capture → smart routing → AI replies → timers → reports.

---

## 16. Local dev quickstart (for the next dev)

```bash
# Clone
git clone https://github.com/Aditya-Dhodapkar/contract-ivy-devs.git
cd contract-ivy-devs

# Install
npm install

# Env
cp .env.example .env.local
# In .env.local set:
#   AUTH_SECRET=$(openssl rand -base64 32)
#   USE_DEV_DATA=true
# Optionally also create a .env file with:
#   ANTHROPIC_API_KEY=sk-ant-...   (only needed for brochure generation)

# Run
npm run dev           # http://localhost:3001

# Tests
node --experimental-strip-types scripts/test-logic.ts
npx tsc --noEmit
```

Dev logins (password is `password` for all):
- `owner@test.com` → Owner
- `assistant@test.com` → Assistant
- `gm@test.com` → General Manager
- `agent@test.com` → Agent

---

## 17. Production checklist (run this before going live)

- [ ] Supabase project created under the client's account
- [ ] `migrations/001_init.sql` applied
- [ ] `migrations/002_brochure_fields.sql` applied
- [ ] Storage bucket `property-photos` exists and is public
- [ ] `.env.local` on production host has:
  - [ ] `AUTH_SECRET` (newly generated 32-byte random)
  - [ ] `USE_DEV_DATA=false`
  - [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
        `SUPABASE_STORAGE_BUCKET`
  - [ ] `ANTHROPIC_API_KEY` (client's, with billing tied to her account)
- [ ] Logo at `public/sansi-logo.jpg`
- [ ] At least one real Owner user seeded in Supabase (the founder), then
      she invites the rest of the team via the UI
- [ ] Domain set up — e.g. `admin.sansi.africa` pointing at the deployment
- [ ] Smoke-test: login as the Owner, create a property, generate a
      brochure, check status changes work, check the approval queue
- [ ] (Future) Vercel deploy with `puppeteer-core` + `@sparticuz/chromium`
      configured for the brochure PDF route

---

## 18. Known gotchas

- **Property list shows three badges per row.** Don't reduce — the user
  explicitly asked for all three after we initially had only Status +
  Approval.
- **The brochure preview/edit page** (`/properties/[id]/brochure`) fires
  the Claude draft on mount. ~7-second latency. The UI shows a "Drafting
  with Claude…" message during that wait. Don't change this without
  considering the cost (each open = one API call).
- **`@react-pdf/renderer` font registration** is broken for Google Fonts
  CDN URLs (they 404 on the static-TTF paths). If you keep `@react-pdf`,
  bundle TTFs locally under `public/fonts/`. If you swap to Puppeteer
  per §10, this whole class of bugs goes away.
- **`Carol Lees.zip` at `kenya/Carol Lees.zip`** is 31 MB — the original
  client zip. Safe to delete; contents are unzipped into `kenya/netlify/`.
- **The dev server runs on port 3001**, not 3000, so it doesn't clash with
  the public website's dev server (which uses 3000 if you spin it up).
- **`USE_DEV_USERS`** is the legacy flag name still accepted as an alias
  for `USE_DEV_DATA`. Honour both for one cycle; remove later.
- **Photo file size cap is 10 MB**, enforced in `/api/upload` via the
  Content-Length header check BEFORE `formData()` parses. Without that
  check, oversized uploads 500 instead of 413.
- **Idempotency** for property creation is enforced via a UUID issued
  on form mount + a Postgres unique index. Plus a 5-attempt retry loop
  for reference-number collisions. Plus a client-side `useRef` lock to
  block double-click. Three layers — don't strip them.

---

## 19. Two messages we drafted but did not send (for the manager to forward)

These are sitting in chat history; reproducing them here so they're not
lost. Both are written for the manager (Alex/Ishan) to forward (or
paraphrase) to the client.

### Message: Meta Business verification (start ASAP, 1–3 wks lead time)

> Hey — quick one on something time-sensitive for the Sansi Africa build.
>
> The system we're building has a Phase 2 feature where WhatsApp messages
> sent to her business number get automatically caught as leads, and the
> AI drafts a reply that she can approve from her phone with one tap.
> That whole flow runs on **WhatsApp's official Business API**, which is
> owned by Meta (Facebook's parent).
>
> Before any code on our side can connect to WhatsApp, **Meta has to
> verify her business is a real legitimate company**. This is called
> *Meta Business Verification*. Two important things about it:
>
> 1. It takes 1–3 weeks to be approved — longest pole on the project.
> 2. It has to be done under her identity, not ours.
>
> Could you ask her to begin it this week?
>
> **For her ↓**
>
> Hi — for the WhatsApp lead-capture and AI reply features in your new
> system to work, we need to register your business with WhatsApp's
> official business platform. WhatsApp is owned by Meta (Facebook), and
> they require every business that uses their official tools to be
> verified.
>
> Steps (~30–45 minutes of your time):
> 1. Go to business.facebook.com and sign in / create a Meta Business
>    account under your business email
> 2. Add your business details: legal company name, registered address,
>    contact phone, website link
> 3. Open Security Center → Business Verification → Start
> 4. Upload: company registration certificate, utility bill or bank
>    statement, your government ID
> 5. Settings → WhatsApp Accounts → Add your business WhatsApp number
>
> Meta will email when approved (1–3 weeks).

### Message: Zoho setup

> Hey — second ask, similar to the WhatsApp one. We need to start setting
> up her **Zoho** stack (Mail + CRM + Campaigns) for the Phase 2
> lead-capture, follow-up, and mailing features.
>
> **For her ↓**
>
> Hi — to wire up the lead management, business email, and mailing list
> parts of your new system, we need you to set up your Zoho account.
>
> Steps:
> 1. Sign up at zoho.com with your business email
> 2. Subscribe to: Zoho CRM (free), Zoho Mail (~$1/user/month — needed
>    for the @sansi.africa address), Zoho Campaigns (free)
> 3. Verify the sansi.africa domain for Zoho Mail (add MX + TXT records
>    at the domain registrar)
> 4. Create the mailbox `connect@sansi.africa`
> 5. Once Mail is verified, go to api-console.zoho.com, create a "Self
>    Client", and send the Client ID + Client Secret + Refresh Token
>
> 24–48h DNS wait expected.

---

## 20. Honest reflection (what to watch out for)

- The reference brochure (`netlify/index.html`) is bespoke per-property
  copy. Templating it properly is a real exercise — see §10. Don't
  underestimate the work to finish the slot extraction.
- The pre-publish mandate-doc seam (`#59`) is fake-passing because
  `hasMandateDoc()` returns false. The actual checklist correctly flags
  it as missing. When Step 3 ships, that ONE function change unblocks
  publish.
- We've not stress-tested anything against a real Supabase project. The
  prod branch is "code-reviewed and typechecked" only. **First deploy is
  the integration test.** Build a small smoke script that hits at least
  create/list/edit/delete/upload against the real Supabase before going
  live.
- The user the dev was working with is moving fast and pushes back on
  defaults. Listen to it — most of the late-stage refinements (no native
  dialogs, sidebar callout for approvals, ChipInput for nearby places,
  reset-password-not-set-password, hard delete for users, etc.) came
  from that feedback and made the product meaningfully better.
- Whatever you ship: **commit and push it**. The repo is the handoff
  artifact. `git status` should be clean by EOD.
