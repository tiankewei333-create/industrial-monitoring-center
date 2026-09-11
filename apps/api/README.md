# @imc/api

Fastify + Postgres / Timescale business API (auth · assets · alarms · history · KPI).

```bash
npm run docker:up
npm run db:migrate
npm run dev:live:db
```

Endpoints:

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ ok, db, timescale }` |
| POST | `/auth/login` | HS256 JWT (`JWT_SECRET`) |
| GET | `/assets` | registry |
| POST/PATCH/DELETE | `/assets` | admin + Bearer JWT |
| GET | `/alarms` | Postgres alarms |
| GET | `/history?assetId=&from=&to=` | Timescale downsampled series |
| GET | `/kpi?from=&to=` | availability / fault share |
| GET/POST | `/work-orders` | list / create (operator+admin) |
| PATCH | `/work-orders/:id` | status / assignee / note |

Schema: `deploy/sql/*.sql` (Postgres) + `deploy/sql/ts/*.sql` (Timescale).
