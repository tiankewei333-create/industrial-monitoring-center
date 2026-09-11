/**
 * IMC shared protocol types (Year 1 freeze).
 * Keep this file stable — UI beauty matters less than protocol stability.
 */

export type AssetStatus = "OFFLINE" | "IDLE" | "RUNNING" | "FAULT";

export type AssetType =
  | "CNC"
  | "ROBOT"
  | "CONVEYOR"
  | "SENSOR"
  | "WAREHOUSE"
  | "ENERGY";

export interface TelemetryMetrics {
  temperature: number; // °C
  speed: number; // rpm or m/min depending on type
  power: number; // kW
}

/** Standard MQTT / ingest payload */
export interface TelemetryPayload {
  assetId: string;
  ts: number; // epoch ms
  metrics: TelemetryMetrics;
  status: AssetStatus;
}

export interface AssetRecord {
  assetId: string;
  name: string;
  type: AssetType;
  zone: string;
  status: AssetStatus;
  updatedAt: string; // ISO8601
}

export const DEFAULT_THRESHOLDS = {
  temperatureMaxC: 80,
  powerMaxKw: 15,
  offlineTimeoutSec: 30,
} as const;

export const MQTT_TOPICS = {
  telemetry: "imc/telemetry",
  telemetryAsset: (assetId: string) => `imc/telemetry/${assetId}`,
} as const;

/** Alarm closed-loop (MVP: in-memory in realtime) */
export type AlarmRule = "TEMP_HIGH"; // 以后可扩 POWER_HIGH / OFFLINE
export type AlarmSeverity = "WARNING" | "CRITICAL";
export type AlarmState = "ACTIVE" | "ACKED" | "CLEARED";

export interface AlarmRecord {
  alarmId: string;
  assetId: string;
  rule: AlarmRule;
  severity: AlarmSeverity;
  state: AlarmState;
  value: number; // 触发时的温度等
  threshold: number; // 一般用 DEFAULT_THRESHOLDS.temperatureMaxC
  raisedAt: number; // epoch ms
  ackedAt?: number;
  clearedAt?: number;
  ackedBy?: string; // 操作人用户名
}

/** Compact history point (memory ring + Timescale downsample). */
export interface HistorySample {
  ts: number;
  temperature: number;
  speed: number;
  power: number;
  status: AssetStatus;
}

export interface HistorySeries {
  assetId: string;
  samples: HistorySample[];
}

/** ~15 min at 1 Hz in realtime memory. Longer windows via Timescale. */
export const HISTORY_DEFAULTS = {
  maxPoints: 900,
} as const;

/** Availability / fault KPI from Timescale telemetry. */
export interface KpiAssetRow {
  assetId: string;
  samples: number;
  /** Fraction of samples with status RUNNING (0–1). */
  availability: number;
  faultRatio: number;
  avgTemperature: number | null;
  avgPower: number | null;
  running: number;
  idle: number;
  fault: number;
  offline: number;
}

export interface KpiOverview {
  from: string;
  to: string;
  source: "timescale";
  assetCount: number;
  sampleCount: number;
  availability: number;
  faultRatio: number;
  assets: KpiAssetRow[];
}

/** Maintenance work order (alarm → WO). */
export type WorkOrderStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type WorkOrderPriority = "NORMAL" | "HIGH";

export interface WorkOrderRecord {
  workOrderId: string;
  alarmId?: string;
  assetId: string;
  title: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  createdBy: string;
  assignedTo?: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

/** WebSocket wire format (realtime ↔ web) */
export type WsServerMessage =
    | { type: "hello"; service: string; mqttUrl: string; embeddedMqtt: boolean }
    | { type: "snapshot"; assets: TelemetryPayload[] }
    | { type: "telemetry"; data: TelemetryPayload }
    | { type: "status"; mqttConnected: boolean }
    | { type: "alarm"; data: AlarmRecord }
    | { type: "alarms_snapshot"; alarms: AlarmRecord[] }
    | { type: "history_snapshot"; series: HistorySeries[] };

export type WsClientMessage =
  | { type: "alarm_ack"; alarmId: string; ackedBy?: string };
