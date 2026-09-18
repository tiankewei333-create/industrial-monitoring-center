# Runbook

## Postgres + Timescale (auth / assets / alarms / history / KPI)

```bash
# 1) start Postgres + Timescale (+ mosquitto infra)
npm run docker:up

# 2) migrate PG schema + Timescale hypertable
npm run db:migrate

# 3) run stack with API
npm run dev:live:db
```

Set `DATABASE_URL` and `TIMESCALE_URL` in `.env` (see `.env.example`).  
Realtime writes alarms/assets to Postgres and batches telemetry to Timescale when URLs are set.

API: http://localhost:3001/health (`db` + `timescale`)  
Login/assets/history/KPI go through same-origin `/api`.

## Docker MVP (recommended deploy smoke)

One-command stack: **Postgres + Timescale + Mosquitto + api + realtime + simulator + web**.

```bash
cp .env.example .env
npm run docker:mvp
```

Open http://127.0.0.1:3000/login  
API: http://127.0.0.1:3001/health  
Realtime: http://127.0.0.1:3002/health  

Stop:

```bash
npm run docker:mvp:down
```

Logs / ps:

```bash
npm run docker:logs
npm run docker:ps
```

## Infra only (Postgres / Redis / Mosquitto)

```bash
npm run docker:up
```

## Local MVP (no Docker)

```bash
npm run dev:live
```

Vite proxies `/ws` → `ws://127.0.0.1:3002/ws` (see `apps/web/vite.config.ts`).

Alarm demo variants:

```bash
npm run dev:live:spike   # 15s hot / 20s cool — raise → ack → clear
npm run dev:live:hot     # hold T=86°C
```

## Health checks

- Realtime: `GET http://localhost:3002/health`  
  Expect fields: `ok`, `assets`, `alarms`, `openAlarms`, `historyPoints`, `clients`
- Web: http://localhost:3000/login
- Twin: http://localhost:3000/twin
- API (when available): `GET http://localhost:3001/health`

## Alarm closed-loop smoke test

1. `npm run docker:mvp` **or** `npm run dev:live:spike`
2. Login as `operator` / `operator123`
3. Open `/alarms` — wait for `TEMP_HIGH` / `ACTIVE`
4. Ack → `ACKED`; after cool phase → `CLEARED`
5. Confirm `observer` cannot Ack

Alarms are persisted in Postgres when `DATABASE_URL` is set. Live history ring buffer still clears on realtime restart; Timescale retains telemetry (~30 days).

Thresholds and audit: http://localhost:3000/settings (admin can edit thresholds).

## Backup / restore

```bash
npm run db:backup
```

Writes `backups/imc-postgres-*.sql` and `backups/imc-timescale-*.sql` via `docker exec … pg_dump`. Restore:

```bash
docker exec -i imc-postgres psql -U imc -d imc < backups/imc-postgres-<stamp>.sql
docker exec -i imc-timescale psql -U imc -d imc_ts < backups/imc-timescale-<stamp>.sql
```

## History curves

- UI: http://localhost:3000/history (1h live / 6h+ Timescale)
- API: `GET http://localhost:3001/history?assetId=Machine001&from=…&to=…`
- Memory debug: `GET http://localhost:3002/history?assetId=Machine001`

## KPI / energy

- UI: http://localhost:3000/kpi
- API: `GET http://localhost:3001/kpi?from=…&to=…`
- Energy: `GET http://localhost:3001/energy?from=…&to=…` (estimated kWh)

## Twin / wallboard

- Twin: http://localhost:3000/twin (3D / 2D toggle)
- Wall: http://localhost:3000/wall
- Models: `apps/web/public/models/*.glb` (`npm run models:twin`)

## MQTT credentials (Compose)

Compose Mosquitto generates a password file from `MQTT_USER` / `MQTT_PASSWORD` and sets `allow_anonymous false`. Realtime, simulator, and ingest receive the same env.

Local `npm run dev:live` uses embedded Aedes (no password). To point host processes at Compose Mosquitto:

```env
IMC_EMBED_MQTT=false
MQTT_URL=mqtt://127.0.0.1:1883
MQTT_USER=imc
MQTT_PASSWORD=imc_mqtt_password
```

Anonymous `mosquitto_sub` against Compose MQTT should fail.

## Metrics

- `GET http://localhost:3002/metrics` (Prometheus text)
- Docker web: `GET http://127.0.0.1:3000/realtime-metrics`

Login is rate-limited (20 attempts / IP / minute → HTTP 429). Production API and realtime refuse the default `JWT_SECRET` unless `IMC_ALLOW_DEFAULT_JWT=true` (lab only). Production web builds disable mock login unless `VITE_ALLOW_MOCK_AUTH=true`. See [demo.md](./demo.md) for the showcase talk track.

## Plant hardening (unattended line — not in this repo)

This stack is a **lab / small-workshop B tier**. Unattended plant software additionally needs: MQTT+HTTPS TLS, no default passwords, HA Postgres/MQTT, 72h soak, real PLC/OPC-UA ingest, backup restore drills, IEC 62443 / ISA-18.2 process, on-call + log shipping, change control. See the project README out-of-scope note.

