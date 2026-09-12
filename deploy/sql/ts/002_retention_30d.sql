-- Year 1 P0: keep at least 30 days of telemetry
SELECT remove_retention_policy('telemetry', if_exists => TRUE);
SELECT add_retention_policy('telemetry', INTERVAL '30 days', if_not_exists => TRUE);
