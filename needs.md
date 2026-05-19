# Needs — Before & During the Build

What we need from each side to finish the system. Nothing here is optional fluff — each item blocks a specific deliverable.

The manager is **not technical**. So all technical setup is on us. A few accounts must be created under the **client's** identity/billing (legal + cost reasons), then access granted to us. The manager's job is to be the **relay** — get answers and access from the client and pass them to us.

---

## From the Manager (relay only)

He is the messenger, not a doer. We need him to:

1. Get the client to create the owner-billed accounts below and grant us access
2. Collect content & answers from the client (see her section) and pass them to us
3. Give written scope sign-off (Phase 1 vs Phase 2, what's in/out for the agreed price)
4. Confirm single point of contact and the launch deadline
5. Push the Meta Business verification to start **today** (1–3 week lead time, blocks WhatsApp)

---

## From the Kenyan Lady (the client)

### Accounts she must own (created under her email + her billing — we get access, not ownership)

6. Anthropic Claude account + API key (she says credits are loaded — we need the key)
7. Zoho account (CRM + Mail + Campaigns) — created under her, access granted to us
8. Meta Business account + Business verification — needs her company's legal documents/ID; cannot be done under our identity
9. M-Pesa Paybill number (hers entirely — display only)

### Content
10. Property data + photos + floor plans for initial listings
11. Signed mandate / title deed / deed plan documents for those properties
12. Final list of awards & recognitions to feature, with logos
13. 3–5 examples of past replies in her own writing voice (so AI drafts sound like her)
14. Tree-planting certificate design (logo, signature, layout)
15. Founder's WhatsApp business number
16. Founder + team member names, emails, and which region each agent covers

### Decisions
17. Complete list of regions for the property filter
18. Access code format — per property? per region?
19. Membership applications — auto-accepted, or does she review each one?
20. How long to keep documents on sold/inactive properties
21. The external URL for "Property Management" (links to her friend's separate company)
22. Confirm the brochure template design to lock down

---

## What We Are Doing

Everything technical. The manager cannot do any of this, so we own it end to end.

### Technical setup we handle (ours to do)
- GitHub repo + code handoff
- Vercel hosting + deploys
- Sanity CMS project, schema, tokens
- Cloudflare R2 / AWS S3 bucket + access logging
- Claude API integration (using her key)
- Zoho CRM / Mail / Campaigns configuration + API wiring (using her granted access)
- WhatsApp Business Cloud API technical connection (once her Meta verification clears)

### System build (full scope — see `deliverables.md`, 130 features)
- The private back-office app (login → property management → documents → reports → logout)
- 4-role permission system
- Pre-publish checklist
- Secure document storage with access logging
- Brochure PDF generator
- Certificate PDF generator
- Phase 2: lead capture from website / email / WhatsApp
- Phase 2: smart routing, AI-drafted replies, follow-up timers
- Phase 2: mailing list, weekly reports

We are **not** building the public website (already done) and **not** processing any payments (M-Pesa is display-only).

---

## Important boundaries

- **Account ownership stays with the client, not us.** We get *access*, never create her business accounts under our personal identity or billing. (Otherwise she's locked to us, and we're liable for her API/Meta usage and costs.)
- **Taking on all technical setup is significant extra work** (Zoho + WhatsApp/Meta config alone is days of integration). It must be named explicitly in scope, not absorbed silently.
- Anything unanswered here is a **blocker** on its related feature. The build can start without all of them; it cannot be *finished and launched* until each is resolved.
