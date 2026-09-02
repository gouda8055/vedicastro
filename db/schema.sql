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
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  reset_token_hash    TEXT,
  reset_token_expires TIMESTAMPTZ,
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

CREATE TABLE IF NOT EXISTS daily_horoscopes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sign           TEXT NOT NULL,
  horoscope_date DATE NOT NULL,
  general        TEXT NOT NULL,
  love           TEXT NOT NULL,
  career         TEXT NOT NULL,
  finance        TEXT NOT NULL,
  health         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sign, horoscope_date)
);

-- Weekly/Monthly/Yearly horoscopes, sharing one table: period_type +
-- period_key together identify one AI generation per sign per period
-- (e.g. period_type='weekly', period_key='2026-W36'). One AI call
-- generates all 12 signs for a period at once, then it's cached here —
-- same pattern as daily_horoscopes above.
CREATE TABLE IF NOT EXISTS period_horoscopes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type  TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'yearly')),
  sign         TEXT NOT NULL,
  period_key   TEXT NOT NULL,
  period_label TEXT NOT NULL,
  general      TEXT NOT NULL,
  love         TEXT NOT NULL,
  career       TEXT NOT NULL,
  finance      TEXT NOT NULL,
  health       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_type, sign, period_key)
);

-- Daily Panchang: the numeric/timing fields (Tithi, Yoga, Karana, sunrise,
-- Rahu Kaal etc.) are computed with real astronomy, not AI — only
-- `overview` is AI-written natural-language text. One row per calendar day.
CREATE TABLE IF NOT EXISTS daily_panchang (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panchang_date    DATE NOT NULL UNIQUE,
  tithi            TEXT NOT NULL,
  paksha           TEXT NOT NULL,
  nakshatra        TEXT NOT NULL,
  yoga             TEXT NOT NULL,
  karana           TEXT NOT NULL,
  sunrise          TEXT NOT NULL,
  sunset           TEXT NOT NULL,
  rahu_kaal        TEXT NOT NULL,
  gulika_kaal      TEXT NOT NULL,
  yamaganda_kaal   TEXT NOT NULL,
  abhijit_muhurat  TEXT NOT NULL,
  overview         TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If the users table already existed before these columns were added,
-- CREATE TABLE IF NOT EXISTS above won't add them — these will:
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
