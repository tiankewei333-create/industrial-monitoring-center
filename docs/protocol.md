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

## Alarms

Raised by `imc-realtime`:

- `TEMP_HIGH` when `metrics.temperature` > configured `temperatureMaxC` (default 80)
- `POWER_HIGH` when `metrics.power` > configured `powerMaxKw` (default 15)
- `OFFLINE` when no telemetry for `offlineTimeoutSec` (default 30)

Thresholds live in Postgres (`app_settings.thresholds` + optional per-asset columns). Realtime reloads them every 5s.

State machine: `ACTIVE` → `ACKED` → `CLEARED`

- Same `assetId` + `rule` cannot raise again while `ACTIVE` or `ACKED`.
- Clear only after `ACKED` and the condition is gone (or Ack while already clear → `CLEARED`).

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
- `auth_ok` / `auth_error` — after client `auth`
- `ack_error` — Ack rejected (unauthorized / forbidden / not_active)

HTTP (realtime, debug):

- `GET /history` — all series
- `GET /history?assetId=Machine001` — one asset

WebSocket (client → server):

- `auth` — `{ "type": "auth", "token": "<JWT>" }` (required before Ack; identity comes from the token, not the client)
- `alarm_ack` — `{ "type": "alarm_ack", "alarmId": "..." }`

REST (api):

- `GET /thresholds` · `PUT /thresholds` (admin)
- `PUT /assets/:assetId/thresholds` (admin; `null` inherits global)
- `GET /audit` (authenticated)
- `GET /energy?from=&to=` — estimated kWh from Timescale `avg(power) × duration`

## MQTT auth (Compose MVP)

Mosquitto is started with `allow_anonymous false`. Set `MQTT_USER` / `MQTT_PASSWORD` (see `.env.example`). Local `dev:live` still uses embedded Aedes (anonymous) unless `IMC_EMBED_MQTT=false`.

Realtime `GET /metrics` is Prometheus text (`imc_mqtt_messages_total`, `imc_ws_clients`, `imc_open_alarms`, `imc_assets_seen`).

## History (MVP)

In-memory ring buffer in `imc-realtime` (default 900 points ≈ 15 min at 1 Hz).
When `TIMESCALE_URL` is set, realtime also batch-inserts into Timescale `telemetry`.
Longer windows: `GET /api/history?assetId=&from=&to=` (downsampled via `time_bucket`).
KPI: `GET /api/kpi?from=&to=` (availability = RUNNING sample share).
Energy: `GET /api/energy?from=&to=` (`avg(power_kW) × hours`).
Retention: 30 days.

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

