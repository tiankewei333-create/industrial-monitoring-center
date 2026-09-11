-- IMC Postgres schema (Year 1 MVP)
-- Applied by: npm run db:migrate

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('observer', 'operator', 'admin')),
  display_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  asset_id   TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  zone       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'OFFLINE'
               CHECK (status IN ('OFFLINE', 'IDLE', 'RUNNING', 'FAULT')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alarms (
  alarm_id   TEXT PRIMARY KEY,
  asset_id   TEXT NOT NULL REFERENCES assets (asset_id)
               ON UPDATE CASCADE ON DELETE CASCADE,
  rule       TEXT NOT NULL,
  severity   TEXT NOT NULL CHECK (severity IN ('WARNING', 'CRITICAL')),
  state      TEXT NOT NULL CHECK (state IN ('ACTIVE', 'ACKED', 'CLEARED')),
  value      DOUBLE PRECISION NOT NULL,
  threshold  DOUBLE PRECISION NOT NULL,
  raised_at  TIMESTAMPTZ NOT NULL,
  acked_at   TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ,
  acked_by   TEXT
);

CREATE INDEX IF NOT EXISTS alarms_state_idx ON alarms (state);
CREATE INDEX IF NOT EXISTS alarms_asset_idx ON alarms (asset_id);
CREATE INDEX IF NOT EXISTS alarms_raised_idx ON alarms (raised_at DESC);
