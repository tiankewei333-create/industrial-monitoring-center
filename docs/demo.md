# IMC demo script (≈60–90 seconds)

Use this for GitHub visitors, Upwork calls, and interviews.
Goal: prove a **real pipeline** and an **operable alarm closed loop** — not a fake UI animation.

## Recommended showcase stack

**Option A — full Docker MVP (best for “product” demos)**

```bash
cp .env.example .env
npm install
npm run docker:mvp
```

Open http://127.0.0.1:3000

**Option B — local alarm demo (best for closed-loop ack/clear)**

```bash
cp .env.example .env
npm install
npm run dev:live:spike
```

Spike mode cycles hot/cool so you can show `ACTIVE → ACKED → CLEARED` in one sitting.

## Demo accounts (lab only)

| User | Password | Show |
|---|---|---|
| `operator` | `operator123` | Ack alarms, work orders |
| `observer` | `observer123` | Read-only (Ack disabled) |
| `admin` | `admin123` | Thresholds / settings |

These are **seeded demo credentials**. Do not reuse on a public plant host. Set a strong `JWT_SECRET` and `IMC_ALLOW_DEFAULT_JWT=false` before any exposed deploy.

## 60-second talk track

1. **Login** (`operator`) — roles exist; unauthenticated routes redirect.  
2. **Live** — temperatures move; status shows `WS open` / MQTT live.  
3. **Proof it is real** — stop the simulator (or kill the publisher): UI updates stop.  
4. **Alarms** — open `/alarms`, point at `TEMP_HIGH` / `ACTIVE`.  
5. **Ack** — click Ack → `ACKED` with operator identity.  
6. **Clear** — wait for cool phase (spike) → `CLEARED`.  
7. **Twin (optional)** — `/twin`: pick a machine, heat color follows live temperature.  
8. **History / KPI (optional)** — `/history`, `/kpi` for traceability narrative.

## Acceptance checklist (showcase minimum)

- [ ] `GET /health` on realtime returns `"ok": true`
- [ ] Live values change without refreshing the page
- [ ] Stopping the publisher stops UI updates
- [ ] Alarm raise → ack → clear works for `operator`
- [ ] `observer` cannot ack
- [ ] Docker MVP or `dev:live:spike` starts from a clean clone via README

## Architecture one-liner

```text
simulator / devices → MQTT → realtime (rules) → WebSocket → React / 3D twin
                              ↘ Postgres / Timescale ← REST API
```

Details: [architecture.md](./architecture.md) · [business-logic.md](./business-logic.md) · [runbook.md](./runbook.md)
