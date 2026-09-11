-- Maintenance work orders (alarm → WO closed loop)

CREATE TABLE IF NOT EXISTS work_orders (
  work_order_id TEXT PRIMARY KEY,
  alarm_id      TEXT REFERENCES alarms (alarm_id) ON DELETE SET NULL,
  asset_id      TEXT NOT NULL REFERENCES assets (asset_id)
                  ON UPDATE CASCADE ON DELETE CASCADE,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'OPEN'
                  CHECK (status IN ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
  priority      TEXT NOT NULL DEFAULT 'NORMAL'
                  CHECK (priority IN ('NORMAL', 'HIGH')),
  created_by    TEXT NOT NULL,
  assigned_to   TEXT,
  note          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS work_orders_status_idx ON work_orders (status);
CREATE INDEX IF NOT EXISTS work_orders_asset_idx ON work_orders (asset_id);
CREATE INDEX IF NOT EXISTS work_orders_created_idx ON work_orders (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_alarm_uniq
  ON work_orders (alarm_id)
  WHERE alarm_id IS NOT NULL;
