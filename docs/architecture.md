# Architecture

## MVP（已实现）

```
imc-simulator
      │ MQTT publish  imc/telemetry/Machine001
      ▼
embedded Aedes（默认）或外部 Mosquitto
      │ MQTT subscribe imc/telemetry/#
      ▼
imc-realtime  ── WebSocket /ws ──► imc-web
      │
      └── GET /health
```

说明：

- 前端 **不** 直连 MQTT；只连自有 WS。
- `imc-ingest` 在 MVP 由 realtime 兼任；后续再拆独立接入与落库。

## 目标态（Year 1）

```
[PLC/传感器/模拟器]
        │ MQTT
        ▼
[imc-ingest] ──► PostgreSQL / Timescale / Redis
        │
        ▼
[imc-realtime] ── WebSocket ──► [imc-web]
[imc-api]      ── REST ────────► [imc-web]
```
