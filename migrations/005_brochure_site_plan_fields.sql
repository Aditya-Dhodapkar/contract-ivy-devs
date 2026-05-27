-- Page-4 "Land & tenure" particulars table rows that didn't fit the
-- existing schema. All optional text; rows with no data simply don't render.
-- Idempotent.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS topography TEXT, -- e.g. "Gently sloping, well-drained"
  ADD COLUMN IF NOT EXISTS boundary   TEXT, -- e.g. "Mature hedge & perimeter fence"
  ADD COLUMN IF NOT EXISTS services   TEXT; -- e.g. "Mains water · grid power · borehole-ready"
