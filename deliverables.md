# Sansi Africa — Deliverables

Every feature we need to build. The public website is excluded (already done). Scope below = the back-office system + generators + Phase 2 automations + integrations.

Each item is one atomic feature. Numbered sequentially.

**Markers:** ✅ done & tested · 🟡 partial / seam in place · (unmarked) not started

---

## Authentication & Access

1. ✅ Login
2. ✅ Logout
3. Forgot password
4. Reset password
5. ✅ Stay logged in (session persistence)
6. ✅ Create user (Owner only)
7. ✅ Edit user
8. ✅ Deactivate user (soft — record persists)
9. ✅ Assign role to user
10. ✅ Role-based access enforcement (4 roles)
11. ✅ Owner role — full access incl. delete & user management
12. ✅ Assistant role — create/edit/publish, no delete
13. ✅ General Manager role — read-only across everything
14. ✅ Agent role — own assigned properties only

## Back-Office Shell

15. ✅ Logged-in dashboard / home screen
16. 🟡 Mobile-responsive layout (responsive so far; more screens coming)
17. ✅ Navigation between sections

## Property Management

18. ✅ Create property record
19. ✅ Edit property record
20. ✅ View property detail
21. ✅ List all properties (back office)
22. ✅ Auto-generate unique reference number (e.g. SA-2026-001)
23. ✅ Set region
24. ✅ Set price
25. ✅ Set bedrooms
26. ✅ Set bathrooms
27. ✅ Set plot size
28. ✅ Set property type (house / apartment / land / commercial)
29. ✅ Set description
30. ✅ Set map location (lat/lng fields + Mapbox locality embed on brochure)
31. ✅ Upload photos (real /api/upload, multi-file, HEIC support, 10 MB cap, sharp dimension capture)
32. ✅ Manage photo gallery (reorder via ← →, primary picker, remove)
33. ✅ Set primary photo (★ button, blocked for landscape photos to protect cover)
34. ✅ Upload floor plan (multi-image support via `floor_plans TEXT[]`, migration 009)
35. ✅ Assign agent to property (real picker sourced from active agents)
36. Link property to its seller/owner contact
37. ✅ Set status: Draft
38. ✅ Set status: Active
39. ✅ Set status: Sold
40. ✅ Set status: Rented
41. ✅ Change status
42. ✅ Sold/Rented banner on primary photo (back office signals it)
43. ✅ Toggle show on website (public)
44. ✅ Toggle keep private (access code)
45. ✅ Assign access code to a private property
46. ✅ Private property hidden from all public lists and search
47. ✅ Delete property (Owner only)
48. ✅ Block delete for all non-Owner roles
49. ✅ Record persists when hidden (history protection)
50. ✅ Filter/search properties in back office (region, status, agent, type)
51. ✅ Agent sees only own properties; cannot see others'

## Pre-Publish Checklist

52. ✅ Validate before publish: min 3 photos
53. ✅ Validate before publish: title
54. ✅ Validate before publish: description
55. ✅ Validate before publish: price
56. ✅ Validate before publish: region
57. ✅ Validate before publish: bedrooms/bathrooms (if house)
58. ✅ Validate before publish: plot size
59. ✅ Validate before publish: signed mandate document uploaded (now real — `hasMandateDoc()` queries the documents table)
60. ✅ Validate before publish: assigned agent
61. ✅ Block publish if any item missing
62. ✅ Show user exactly what is missing

## Document Storage

63. ✅ Upload signed mandate document
64. ✅ Upload title deed document
65. ✅ Upload deed plan document
66. ✅ Secure document storage (dev: `.devdata/documents/` outside `public/`; prod: separate private Supabase bucket via `SUPABASE_DOCUMENTS_BUCKET`)
67. ✅ View document (inline, via auth-gated `/download` route)
68. ✅ Download document (force-save via `?as=download`)
69. ✅ Log every document view (who, when) — JSONB `access_log` per doc row
70. ✅ Log every document download (who, when)
71. ✅ Restrict document access by role (viewDocuments + uploadDocument + deleteDocument capabilities; agents see only own)

## Brochure Generator

72. ✅ Generate brochure PDF (button on property detail → editor page)
73. ✅ Brochure fixed template (6 pages: cover, glance, page-3 variant, site plan, gallery, terms — see HANDOFF.md for full architecture)
74. ✅ Regenerate brochure when property details change (every click is a fresh render — nothing cached)
75. Archive previous brochure version on regeneration (intentionally not built — brochures stream to download, never saved server-side, per client request)

## Certificate Generator

76. Donor certificate form (name, optional tree count, date)
77. Generate certificate PDF
78. Immediate certificate download (no human involvement)

## Membership

79. Capture membership application into back office (name, contact, regions, budget, property type)
80. Membership list management
81. Membership application review/accept (manual — pending client confirmation)

## Phase 2 — Lead Capture

82. Capture lead from website contact form
83. Capture lead from brochure request
84. Capture lead from membership application
85. Capture lead from email (connect@sansi.africa)
86. Capture lead from WhatsApp
87. Create lead record (name, contact, interest, message)
88. Link lead to specific property (if mentioned)
89. Link inquiry to property
90. Contact history view (all properties + all inquiries for one contact)

## Phase 2 — Smart Routing

91. Determine assigned agent by property region
92. Route lead to assigned agent
93. Route lead to agent's personal assistant
94. Route lead to founder + her assistant
95. Route unspecified leads to founder + assistant
96. Email notification of new lead
97. WhatsApp notification to founder of new lead

## Phase 2 — AI-Drafted Replies

98. Auto-draft reply in founder's voice
99. Pull relevant property details into draft
100. Send draft to founder via WhatsApp
101. Approve draft with one tap (then send)
102. Edit draft before sending
103. Never auto-send (human approval enforced)

## Phase 2 — Follow-Up Timers

104. 24-hour no-response timer per inquiry
105. Reminder email + WhatsApp to agent at 24h
106. Escalate to founder at 48h
107. 7-day silence timer
108. Auto-draft friendly follow-up at 7 days
109. Founder reviews and sends follow-up

## Phase 2 — Mailing List

110. Create/manage mailing list
111. Segment contacts (interest, budget, etc.)
112. Select a segment to send to
113. Attach brochure to a campaign
114. Compose and send campaign message

## Phase 2 — Reports

115. Weekly activity report email (Monday morning)
116. Report metric: new inquiries count + by channel
117. Report metric: inquiries still awaiting response
118. Report metric: new properties added + by agent
119. Report metric: properties sold/rented

## Integrations & Infrastructure (setup deliverables)

120. ✅ Next.js app set up (back office)
121. Hosting set up (Vercel) — blocked on Puppeteer swap (`puppeteer` → `puppeteer-core` + `@sparticuz/chromium`) + Supabase provisioning
122. ✅ Code repository handoff (GitHub — `Aditya-Dhodapkar/contract-ivy-devs`)
123. 🟡 Database set up — **Supabase (Postgres + Storage)** (9 SQL migrations authored; repo layer rewritten and typechecked; live project not yet provisioned by client)
124. ✅ Secure document store set up — **Supabase Storage** (separate private bucket `property-documents`; access logging via `property_documents.access_log` JSONB; dev fallback to `.devdata/documents/`)
125. ✅ Anthropic Claude API integration (brochure: 12 per-page prompt modules; vision-driven gallery layout designer; AI replies pending Phase 2)
126. Zoho CRM integration (lead management) — OAuth credentials in `.env`; code wiring pending Phase 2
127. Zoho Mail integration (connect@sansi.africa) — OAuth + App Password pending; client domain verification not done
128. Zoho Campaigns integration (mailing list) — Phase 2
129. WhatsApp Business Cloud API integration (send + receive) — Phase 2; blocked by Meta Business Verification
130. 🟡 Meta Business approval process (external dependency — client is creating Business Manager account; verification submission pending — 1-3 week lead time)

## Bonus features built beyond original brief

131. ✅ **Feedback button** in back-office header → opens modal → posts to GitHub Issues on a configured private repo (text + image attachments). Screenshots commit to an orphan `feedback-attachments` branch so main stays clean. Configured via `GITHUB_FEEDBACK_TOKEN` + `GITHUB_FEEDBACK_REPO`.

132. ✅ **Photo dimension capture + cover guard.** Every photo upload reads `naturalWidth/Height` via `sharp` server-side and via `Image()` client-side (backfills older photos). Landscape photos are blocked from being the primary (cover) because the cover is A4 portrait; brochure render guards against legacy data with a forest-green fallback panel.

133. ✅ **Five page-3 variants** for seller-privacy options: Location (default with map), Within reach (list only), Photo essay (3-photo editorial spread), The setting (atmospheric prose), Provenance (heritage timeline). Each has its own AI prompt + HTML template + photo budget. Owner toggles via Page3VariantEditor.

134. ✅ **AI brochure layout designer.** Claude with vision analyses gallery photos + property context, picks an editorial template + photo order. Returns `{ templateId, photoOrder }`. ~$0.05 per layout call.

135. ✅ **Mapbox locality map** embed on page 3 with brochure-themed CSS filter (outdoors-v12 style, saturate 0.9 + contrast 1.04). Falls back to OSM static maps if no token; falls back to no-map if no coords.

136. ✅ **Photo allocator** — single source of truth for which photo appears on which page. Cover always uses photo[0] (portrait only); page-3 variants reserve photos[1..N]; gallery uses what's left. No photo appears twice across the brochure unless the user explicitly picks it.

137. ✅ **Per-photo captions** (`photoCaptions TEXT[]`) — optional editorial label per image, rendered as a small overlay on gallery tiles.

138. ✅ **Gallery template system** — 11 hand-curated row-partition templates (pair + trio combos only — no strip layouts, no solo-row heroes). Layout engine computes tile dimensions from photo aspect ratios so tiles always match photos (no cropping, no letterboxing).

---

**Total: 138 features** (130 from original brief + 8 bonus features delivered).

**Progress:** ~88 ✅ done · 4 🟡 partial · ~46 remaining (mostly Phase 2 + blocked-on-client-provisioning items).

> Phase 1 = items 1–81 + relevant integration setup (120–125, plus all bonus 131–138).
> Phase 2 = items 82–119 + 126–130.
> See `HANDOFF.md` for full architecture and the prioritised work-list for the next dev.
