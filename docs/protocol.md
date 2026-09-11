# Protocol

Standard telemetry payload (MQTT topic: `imc/telemetry/{assetId}`):

```json
{
  "assetId": "Machine001",
  "ts": 1760000000000,
  "metrics": {
    "temperature": 75.0,
    "speed": 2400,
    "power": 12.0
  },
  "status": "RUNNING"
}
```

Status enum: `OFFLINE` | `IDLE` | `RUNNING` | `FAULT`

TypeScript source of truth: `packages/shared-types/src/index.ts`

## Alarms (MVP)

Raised by `imc-realtime` when `metrics.temperature > DEFAULT_THRESHOLDS.temperatureMaxC` (80).

State machine: `ACTIVE` → `ACKED` → `CLEARED`

- Same `assetId` + `rule` cannot raise again while `ACTIVE` or `ACKED`.
- Clear only after `ACKED` and temperature is back `<=` threshold (or Ack while already below → `CLEARED`).

Example `AlarmRecord`:

```json
{
  "alarmId": "alm_Machine001_TEMP_HIGH_1760000000000",
  "assetId": "Machine001",
  "rule": "TEMP_HIGH",
  "severity": "CRITICAL",
  "state": "ACTIVE",
  "value": 86.2,
  "threshold": 80,
  "raisedAt": 1760000000000
}
```

WebSocket (server → client):

- `alarm` — single alarm change
- `alarms_snapshot` — full in-memory list on connect
- `history_snapshot` — ring-buffer series on connect (`HistorySeries[]`)

HTTP (realtime, debug):

- `GET /history` — all series
- `GET /history?assetId=Machine001` — one asset

WebSocket (client → server):

- `alarm_ack` — `{ "type": "alarm_ack", "alarmId": "...", "ackedBy": "operator" }`

## History (MVP)

In-memory ring buffer in `imc-realtime` (default 900 points ≈ 15 min at 1 Hz).
When `TIMESCALE_URL` is set, realtime also batch-inserts into Timescale `telemetry`.
Longer windows: `GET /api/history?assetId=&from=&to=` (downsampled via `time_bucket`).
KPI: `GET /api/kpi?from=&to=` (availability = RUNNING sample share).

Example `HistorySample`:

```json
{
  "ts": 1760000000000,
  "temperature": 75.0,
  "speed": 2400,
  "power": 12.0,
  "status": "RUNNING"
}
```

