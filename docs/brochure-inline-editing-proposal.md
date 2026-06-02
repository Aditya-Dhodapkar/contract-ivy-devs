# Brochure inline-editing proposal

Status: **deferred** — captured from a design conversation, not yet implemented.

## The problem

When the AI generates a brochure, the copy is 95% right. The remaining 5%
is local detail the client wants to override — swap "makuti" for
"palm-leaf thatch" because Lamu-specific terms confuse a London buyer,
soften a sentence, or fix a name. Today her only options are:

1. Edit the property data and regenerate (slow, burns AI tokens, may
   change other slots she liked).
2. Edit the PDF in Acrobat (off-system, doesn't round-trip).

Neither lets her tune a single paragraph and ship.

## The proposed flow

```
Click "Generate brochure"
         ↓
  AI runs (as today) → produces slot values per page
         ↓
  Save as a brochure_draft row in DB
         ↓
  Redirect to /properties/[id]/brochure/[draftId]/edit
         ↓
  Editable HTML preview ── she tweaks text inline
         ↓                       (autosave on blur)
  Click "Download PDF" → renders same HTML → Puppeteer
```

**Key insight:** decouple AI generation from PDF rendering. Today they're
one pipeline. Split them, with a saved draft in the middle.

## Three concrete pieces

### 1. `brochure_drafts` table

```
id, property_id, page3_variant, gallery_template_id,
slot_data jsonb,         -- exact shape the assembler already consumes
created_at, updated_at, finalised_at
```

### 2. Editable preview at `/properties/[id]/brochure/[draftId]/edit`

Renders the actual templates with every text slot wrapped in a
`contenteditable` span. She clicks any paragraph, types, blur autosaves
via PATCH. Feels like editing a Google Doc — no modal, no markdown, no
learning curve.

### 3. Download PDF reads from the draft, doesn't re-call the AI

What she sees IS what she gets. The PDF route becomes: load draft →
assembler → Puppeteer. AI cost only paid on generate / regenerate.

## Cheap extras once the foundation is there

- **Per-slot ↻ regenerate button** — call just one AI prompt (e.g. only
  `draftProvenanceCopy`'s `para2`). Lets her redo one paragraph without
  losing the rest.
- **Lock toggle per slot** — pin paragraphs she's happy with so a
  "regenerate all" leaves them alone.
- **Word-count ghost** under each editable field — "47 / 40–60" so she
  stays in the prompt's word budget.

## Tradeoffs

`contenteditable` is forgiving for users but messy under the hood —
browsers love injecting stray `<div>`s, `&nbsp;`s, and pasted fonts.
Sanitise on save: strip everything except plain text + `<em>` + `<br>`.
~15 lines.

Alternative: structured form, one textarea per slot. Easier to control
but she's editing a list of fields, not the actual page. The WYSIWYG is
more satisfying.

## MVP scope

- 1 table (`brochure_drafts`)
- 1 edit page (renders templates + contenteditable)
- Autosave PATCH endpoint
- Repoint PDF route to read draft

Roughly a half-day of work. Per-slot regen, locks, versioning are all
follow-ups — defer until she asks.

## Open decisions

- **One draft per property** (overwrite on each generate) vs **multiple
  drafts** (keep "version 1" while trying "version 2"). Single is
  simpler; multiple costs little extra and is genuinely useful if she
  wants to A/B the page-3 variant choice without losing the other.
