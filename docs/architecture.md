# Architecture

## MVP (implemented)

```
imc-simulator
      │ MQTT publish  imc/telemetry/Machine001
      ▼
embedded Aedes (default) or external Mosquitto
      │ MQTT subscribe imc/telemetry/#
      ▼
imc-realtime  ── WebSocket /ws ──► imc-web (/live … /history /kpi /twin)
      │              ▲
      │              └── client: alarm_ack
      ├── TEMP_HIGH rule engine
      ├── history ring buffer (last ~15 min / asset)
      ├── Postgres upsert (alarms + asset status) when DATABASE_URL set
      ├── Timescale batch insert when TIMESCALE_URL set
      └── GET /health  ·  GET /history (memory)

imc-api ── REST /auth /assets /alarms /history /kpi ──► imc-web (via /api proxy)
      ├── Postgres (users, assets, alarms)
      └── Timescale (telemetry hypertable)
```

Notes:

- The browser does **not** connect to MQTT; it only uses the first-party WebSocket.
- `imc-ingest` is temporarily merged into `realtime` for MVP; split when dedicated ingest lands.
- Alarms hydrate from Postgres on realtime restart. History 6h/24h and KPI come from Timescale via `imc-api`.
- Auth uses HS256 JWT (`JWT_SECRET`). Nest migration remains deferred.

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
