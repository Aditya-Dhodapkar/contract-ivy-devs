-- Adds the four fields the page-2 "key facts" keylist needs.
-- All optional; the brochure renderer falls back gracefully when missing.
-- Idempotent.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS tenure         TEXT
    CHECK (tenure IS NULL OR tenure IN ('freehold','leasehold')),
  ADD COLUMN IF NOT EXISTS shape          TEXT,
  ADD COLUMN IF NOT EXISTS site_condition TEXT,
  ADD COLUMN IF NOT EXISTS sale_terms     TEXT;
