# Architecture

## MVP (implemented)

```
imc-simulator
      │ MQTT publish  imc/telemetry/{8 workshop assets}
      ▼
embedded Aedes (local) or Mosquitto with password (Compose)
      │ MQTT subscribe imc/telemetry/#
      ▼
imc-realtime  ── WebSocket /ws ──► imc-web (/live … /twin /wall /settings)
      │              ▲
      │              └── client: auth + alarm_ack (JWT)
      ├── TEMP_HIGH / POWER_HIGH / OFFLINE rules
      ├── thresholds from Postgres (poll ~5s)
      ├── history ring buffer (last ~15 min / asset)
      ├── Postgres upsert (alarms + asset status + audit) when DATABASE_URL set
      ├── Timescale batch insert when TIMESCALE_URL set
      └── GET /health  ·  GET /history (memory)  ·  GET /metrics (Prometheus)

imc-api ── REST /auth /assets /alarms /history /kpi /energy /thresholds /audit /work-orders
      ├── login rate limit + production JWT_SECRET check + CORS
      ├── Postgres (users, assets, alarms)
      └── Timescale (telemetry hypertable)
```

Notes:

- The browser does **not** connect to MQTT; it only uses the first-party WebSocket.
- `imc-ingest` is temporarily merged into `realtime` for MVP; split when dedicated ingest lands.
- Alarms hydrate from Postgres on realtime restart. History 6h/24h and KPI come from Timescale via `imc-api`.
- Auth uses HS256 JWT (`JWT_SECRET`). Nest migration remains deferred.
- **Production / showcase hardening (MVP):**
  - API and realtime refuse the default `JWT_SECRET` unless `IMC_ALLOW_DEFAULT_JWT=true` (lab Compose only).
  - Mock login tokens (`mock.{role}.{ts}`) are disabled when `NODE_ENV=production` unless `IMC_ALLOW_MOCK_AUTH=true`.
  - Web production builds do not fall back to mock login unless `VITE_ALLOW_MOCK_AUTH=true`.
  - Demo accounts in the README are lab seeds only.

## Showcase demo

Step-by-step talk track and acceptance minimum: [demo.md](./demo.md).

## Target (Year 1)

```
[PLC / sensors / simulator]
        │ MQTT
        ▼
[imc-ingest] ──► PostgreSQL / Timescale / Redis
        │
        ▼
[imc-realtime] ── WebSocket ──► [imc-web]
[imc-api]      ── REST ────────► [imc-web]
```
