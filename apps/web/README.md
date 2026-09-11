# @imc/web

React + Vite console: login, live panel, asset registry (mock), alarm center.

Routes (auth required except `/login`):

| Path | Page |
|---|---|
| `/login` | Mock login |
| `/live` | Live telemetry panel |
| `/assets` | Asset registry (mock list) |
| `/alarms` | Alarm center (WS + Ack) |
| `/history` | Metric history (ECharts, in-memory) |
| `/twin` | 3D workshop twin (R3F + glTF) |

```bash
npm run dev -w @imc/web
# or full stack:
npm run dev:live
npm run dev:live:spike
```
