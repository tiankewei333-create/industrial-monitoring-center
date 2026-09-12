-- IMC TimescaleDB telemetry hypertable
-- Applied when TIMESCALE_URL is set: npm run db:migrate

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS telemetry (
  ts          TIMESTAMPTZ NOT NULL,
  asset_id    TEXT NOT NULL,
  temperature DOUBLE PRECISION NOT NULL,
  speed       DOUBLE PRECISION NOT NULL,
  power       DOUBLE PRECISION NOT NULL,
  status      TEXT NOT NULL
);

SELECT create_hypertable('telemetry', 'ts', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS telemetry_asset_ts_idx
  ON telemetry (asset_id, ts DESC);

-- Keep ~30 days of high-res samples (see 002_retention_30d.sql on existing DBs)
SELECT add_retention_policy('telemetry', INTERVAL '30 days', if_not_exists => TRUE);
