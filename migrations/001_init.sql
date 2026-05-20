-- Sansi Africa back-office — initial Postgres schema for Supabase.
--
-- Apply once: paste into the Supabase SQL Editor and Run. Idempotent
-- (CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS) so re-running
-- is safe.
--
-- IDs are TEXT (not UUID) so the JSON dev backend and the Supabase
-- production backend can use the same id strings (prop-…, user-…, etc.)
-- without conversion at the boundary.

-- ---------- USERS ----------
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('owner','assistant','general_manager','agent')),
  assigned_regions      TEXT[],
  personal_assistant_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  password_hash         TEXT NOT NULL,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password  BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq ON users (lower(email));

-- ---------- CONTACTS (sellers / buyers / members) ----------
CREATE TABLE IF NOT EXISTS contacts (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  tags       TEXT[],
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- PROPERTIES ----------
CREATE TABLE IF NOT EXISTS properties (
  id                     TEXT PRIMARY KEY,
  reference_number       TEXT NOT NULL,
  title                  TEXT,
  country                TEXT,
  city                   TEXT,
  property_type          TEXT CHECK (property_type IN ('house','apartment','land','commercial')),
  price                  NUMERIC,                            -- KES
  bedrooms               INT,
  bathrooms              INT,
  year_built             INT,
  year_restored          INT,
  plot_size              TEXT,
  built_area             TEXT,
  description            TEXT,
  highlights             TEXT[],
  amenities              TEXT[],
  nearby                 JSONB,                              -- [{place,distance}]
  photos                 TEXT[],
  floor_plan             TEXT,
  assigned_agent_id      TEXT REFERENCES users(id)    ON DELETE SET NULL,
  seller_id              TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  status                 TEXT NOT NULL DEFAULT 'draft'  CHECK (status   IN ('draft','active','sold','rented')),
  show_on_website        BOOLEAN NOT NULL DEFAULT FALSE,
  is_private             BOOLEAN NOT NULL DEFAULT FALSE,
  access_code            TEXT,
  approval               TEXT NOT NULL DEFAULT 'pending' CHECK (approval IN ('pending','approved','changes_requested')),
  changes_requested_note TEXT,
  idempotency_key        TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS properties_reference_uq        ON properties (reference_number);
CREATE UNIQUE INDEX IF NOT EXISTS properties_idempotency_uq      ON properties (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE        INDEX IF NOT EXISTS properties_assigned_agent_idx  ON properties (assigned_agent_id);
CREATE        INDEX IF NOT EXISTS properties_approval_idx        ON properties (approval);

-- ---------- PROPERTY DOCUMENTS (mandates, deeds — Step 3) ----------
CREATE TABLE IF NOT EXISTS property_documents (
  id           TEXT PRIMARY KEY,
  property_id  TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL CHECK (doc_type IN ('mandate','title_deed','deed_plan')),
  storage_key  TEXT,
  file_name    TEXT,
  uploaded_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_log   JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS property_documents_property_idx ON property_documents (property_id);

-- ---------- LEADS (Phase 2) ----------
CREATE TABLE IF NOT EXISTS leads (
  id                 TEXT PRIMARY KEY,
  contact_id         TEXT REFERENCES contacts(id)   ON DELETE SET NULL,
  property_id        TEXT REFERENCES properties(id) ON DELETE SET NULL,
  assigned_to        TEXT REFERENCES users(id)      ON DELETE SET NULL,
  channel            TEXT CHECK (channel IN ('website','email','whatsapp')),
  message            TEXT,
  status             TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','assigned','responded','follow_up','closed')),
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_team_reply_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS leads_property_idx     ON leads (property_id);
CREATE INDEX IF NOT EXISTS leads_assigned_to_idx  ON leads (assigned_to);
CREATE INDEX IF NOT EXISTS leads_status_idx       ON leads (status);
