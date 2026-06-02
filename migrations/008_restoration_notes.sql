-- Restoration notes — owner's own brief sentence about what was restored.
-- Used by the page-3 "Provenance" brochure variant so the AI can ground its
-- copy in fact instead of hallucinating restoration scope.
-- Idempotent.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS restoration_notes TEXT;
