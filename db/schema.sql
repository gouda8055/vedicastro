-- AstroVeda database schema (PostgreSQL)
-- Run this once against your database before deploying, e.g.:
--   psql "$DATABASE_URL" -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'ultimate')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kundlis (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  gender      TEXT,
  dob         DATE NOT NULL,
  tob         TIME NOT NULL,
  pob         TEXT NOT NULL,
  chart_data  JSONB NOT NULL,   -- lagna, moon sign, nakshatra, planets, houses, dasha
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kundlis_user_id ON kundlis(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  kundli_id   UUID REFERENCES kundlis(id) ON DELETE SET NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS compatibility_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  person1_name  TEXT NOT NULL,
  person1_dob   DATE NOT NULL,
  person1_tob   TIME NOT NULL,
  person1_pob   TEXT NOT NULL,
  person2_name  TEXT NOT NULL,
  person2_dob   DATE NOT NULL,
  person2_tob   TIME NOT NULL,
  person2_pob   TEXT NOT NULL,
  result        JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compat_user_id ON compatibility_reports(user_id);
