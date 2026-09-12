-- Configurable thresholds + operator audit log

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS temperature_max_c DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS power_max_kw DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS offline_timeout_sec INTEGER;

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT
);

INSERT INTO app_settings (key, value, updated_by)
VALUES (
  'thresholds',
  '{"temperatureMaxC":80,"powerMaxKw":15,"offlineTimeoutSec":30}'::jsonb,
  'migrate'
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor        TEXT NOT NULL,
  role         TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT,
  detail       JSONB
);

CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
