# Industrial Monitoring Center (IMC)

Single-workshop industrial monitoring digital twin:
**ingest → store → push → 3D / alarms**.

## Language policy

- **Canonical language for this repository: English**
  (README, code comments, commit messages, CI, `docs/*.md` except `docs/zh/`).
- Chinese notes for personal study live under [`docs/zh/`](docs/zh/).
- User-facing UI copy is English-first (i18n keys may be added later).

## Current MVP data path

```
imc-simulator ──MQTT──► (embedded Aedes / Mosquitto) ──MQTT──► imc-realtime ──WS──► imc-web
```

> `imc-ingest` subscription is temporarily handled by `imc-realtime`; split later.

## 1. Requirements

- Node.js ≥ 20
- Docker (optional for local `dev:live`; required for `docker:mvp`)

## 2. Quick start (recommended)

### A. Local (Node)

```bash
cd D:\projects\industrial-monitoring-center
cp .env.example .env
npm install
npm run dev:live
```

Open: http://127.0.0.1:3000  
Vite proxies `/ws` → realtime `:3002`.

### B. Local with Postgres

```bash
cp .env.example .env
npm install
npm run docker:up          # Postgres + Timescale (+ Redis/Mosquitto infra)
npm run db:migrate
npm run dev:live:db        # api + realtime + simulator + web
```

### C. Docker MVP

```bash
cp .env.example .env
npm run docker:mvp
```

Open: http://127.0.0.1:3000  
Stack: Postgres + Timescale + Mosquitto + api + realtime + simulator + nginx web.

Stop: `npm run docker:mvp:down`

You should see:

1. Login page → use mock accounts below
2. Live panel with **WS open** / **MQTT live**
3. `Machine001` metrics updating about once per second

### Mock accounts

| User | Password | Role |
|---|---|---|
| `observer` | `observer123` | observer |
| `admin` | `admin123` | admin |
| `operator` | `operator123` | operator |

### Acceptance checklist

**Live pipeline**

- [ ] Temperature values change on the live panel
- [ ] Status shows `RUNNING` and occasionally `FAULT`
- [ ] Stopping the simulator stops UI updates (real pipeline, not fake frontend refresh)
- [ ] `GET http://127.0.0.1:3002/health` returns `"ok": true` (includes `openAlarms`)
- [ ] Unauthenticated `/live` redirects to `/login`
- [ ] `/assets` shows mock registry (≥ 5 assets) and links back to Live

**Alarm closed loop (in-memory MVP)**

- [ ] Start with spike/hot simulator (see below)
- [ ] `/alarms` shows `TEMP_HIGH` in `ACTIVE`
- [ ] Live panel shows ACTIVE badge / red count linking to `/alarms`
- [ ] Login as `operator` → **Ack** → state becomes `ACKED`
- [ ] After temperature ≤ 80°C → state becomes `CLEARED`
- [ ] Login as `observer` → Ack button disabled / rejected
- [ ] Restarting `realtime` clears in-memory alarms (expected until Postgres)

**History + Timescale**

- [ ] Live card shows a temperature sparkline that moves
- [ ] Open `/history` — 1h uses live ring; 6h/24h hits Timescale API
- [ ] `GET http://127.0.0.1:3001/history?assetId=Machine001` returns downsampled `samples`
- [ ] `GET http://127.0.0.1:3002/health` shows `"timescale": true` when configured
- [ ] Restarting `realtime` clears the ring buffer; Timescale data remains

**KPI**

- [ ] Open `/kpi` — workshop availability + per-asset table
- [ ] `GET http://127.0.0.1:3001/kpi` returns `availability` / `assets`

**3D twin (R3F + glTF + heat shader)**

- [ ] Open `/twin` — Workshop A with typed glTF stand-ins (`/models/*.glb`)
- [ ] `Machine001` body color follows live temperature (green→yellow→red, 40→90°C)
- [ ] Over 80°C body pulses warmer; status lamp still blinks on FAULT
- [ ] Click a mesh → side panel updates; History / Alarms links work
- [ ] `npm run models:twin` regenerates stand-in GLBs

**Docker MVP**

- [ ] `npm run docker:mvp` builds and starts Postgres + Timescale + mosquitto + api + realtime + simulator + web
- [ ] http://127.0.0.1:3000/login works (JWT session)
- [ ] http://127.0.0.1:3001/health returns `"db": true` and `"timescale": true`
- [ ] http://127.0.0.1:3002/health returns `"postgres": true` and `"timescale": true`
- [ ] After alarm raise, row exists in `alarms`; realtime restart still shows open alarms

### Alarm demo (manual script)

```bash
# Option A — cyclic hot/cool (best for raise → ack → clear)
npm run dev:live:spike

# Option B — hold over-temp
npm run dev:live:hot
```

1. Open http://127.0.0.1:3000/login → `operator` / `operator123`
2. Wait until Live shows an ACTIVE badge (or open `/alarms`)
3. Confirm row: rule `TEMP_HIGH`, state `ACTIVE`, value > 80
4. Click **Ack** → `ACKED` (and `ackedBy=operator`)
5. Wait for cool phase (spike mode) or stop hot mode → `CLEARED`
6. Sign out → login `observer` / `observer123` → Ack disabled

Out of scope this milestone: Postgres persistence, work orders, OFFLINE timeout alarms, 3D highlight.

## 3. Separate processes

```bash
npm run dev:realtime    # :3002 WS + optional embedded MQTT :1883
npm run dev:simulator   # publishes Machine001
npm run dev:simulator:hot    # hold T=86°C (force alarm)
npm run dev:simulator:spike  # 15s hot / 20s cool cycle
npm run dev:live:spike       # full stack with spike cycle
npm run dev:web         # :3000
```

Alarm demo env vars (optional; see `.env.example`): `SIM_FORCE_TEMP`, `SIM_SPIKE`, `SIM_SPIKE_SEC`, `SIM_COOL_SEC`.

Use Compose Mosquitto instead of embedded broker:

```bash
docker compose -f deploy/docker-compose.yml --env-file .env up -d mosquitto
```

In `.env`:

```env
IMC_EMBED_MQTT=false
MQTT_URL=mqtt://127.0.0.1:1883
```

## 4. Repository layout

```
apps/web            Login + live + assets + alarms + history + kpi + twin (React + R3F)
apps/realtime       MQTT → WebSocket bridge + TEMP_HIGH rules (in-memory)
apps/simulator      Fake device publisher (drift / hot / spike modes)
apps/api            Business API (not initialized yet)
apps/ingest         Dedicated ingest (placeholder; MVP uses realtime)
packages/shared-types   Protocol types
deploy/             Docker Compose skeleton
docs/               English project docs
docs/zh/            Personal Chinese notes (non-canonical)
```

## 5. Protocol

See [docs/protocol.md](docs/protocol.md) and `packages/shared-types/src/index.ts`.

## 6. Documentation index

1. [docs/business-logic.md](docs/business-logic.md) — business flows (start here)
2. [docs/architecture.md](docs/architecture.md) · [docs/protocol.md](docs/protocol.md) · [docs/runbook.md](docs/runbook.md)
3. [docs/ui-designs/](docs/ui-designs/) — IMC UI mockups
4. [docs/career-roadmap/](docs/career-roadmap/) — 24-month career roadmap Excel + portfolio UI
5. [docs/zh/](docs/zh/) — Chinese personal reference only

## 7. Year 1 freezes

1. Single workshop (Workshop A)
2. Frontend: React + Three.js / R3F
3. Ingest priority: MQTT
4. Browser uses first-party WebSocket — no direct MQTT from the UI
5. Each quarter must ship a runnable milestone
