# Protocol

标准测点上报（MQTT topic：`imc/telemetry/{assetId}`）：

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

状态枚举：`OFFLINE` | `IDLE` | `RUNNING` | `FAULT`

类型定义见：`packages/shared-types/src/index.ts`
