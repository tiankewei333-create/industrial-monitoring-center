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

export type Thresholds = {
  temperatureMaxC: number;
  powerMaxKw: number;
  offlineTimeoutSec: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  temperatureMaxC: 80,
  powerMaxKw: 15,
  offlineTimeoutSec: 30,
};

export function mergeThresholds(
  global: Thresholds,
  override?: Partial<Thresholds> | null,
): Thresholds {
  return {
    temperatureMaxC: override?.temperatureMaxC ?? global.temperatureMaxC,
    powerMaxKw: override?.powerMaxKw ?? global.powerMaxKw,
    offlineTimeoutSec:
      override?.offlineTimeoutSec ?? global.offlineTimeoutSec,
  };
}

export const MQTT_TOPICS = {
  telemetry: "imc/telemetry",
  telemetryAsset: (assetId: string) => `imc/telemetry/${assetId}`,
} as const;

/** Alarm closed-loop */
export type AlarmRule = "TEMP_HIGH" | "POWER_HIGH" | "OFFLINE";
export type AlarmSeverity = "WARNING" | "CRITICAL";
export type AlarmState = "ACTIVE" | "ACKED" | "CLEARED";

export function alarmValueUnit(rule: AlarmRule): string {
  if (rule === "POWER_HIGH") return "kW";
  if (rule === "OFFLINE") return "s";
  return "°C";
}

export function formatAlarmValue(rule: AlarmRule, value: number): string {
  const unit = alarmValueUnit(rule);
  if (rule === "OFFLINE") return `${Math.round(value)} ${unit}`;
  return `${Number(value).toFixed(1)} ${unit}`;
}

export interface AlarmRecord {
  alarmId: string;
  assetId: string;
  rule: AlarmRule;
  severity: AlarmSeverity;
  state: AlarmState;
  value: number;
  threshold: number;
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

export const WORKSHOP_ASSET_IDS = [
  "Machine001",
  "Machine002",
  "Robot001",
  "Robot002",
  "Conveyor001",
  "Sensor001",
  "Warehouse001",
  "Energy001",
] as const;

export function estimateEnergyKwh(avgPowerKw: number, spanMs: number): number {
  if (!Number.isFinite(avgPowerKw) || avgPowerKw < 0 || spanMs <= 0) return 0;
  return avgPowerKw * (spanMs / 3_600_000);
}

/** Last-sample z-score vs the window. Needs ≥8 points. */
export function zScoreAnomaly(values: number[], z = 2.5): boolean {
  if (values.length < 8) return false;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (std < 1e-6) return false;
  const last = values[values.length - 1];
  return Math.abs(last - mean) / std >= z;
}

export interface EnergyAssetRow {
  assetId: string;
  samples: number;
  avgPowerKw: number;
  energyKwh: number;
}

export interface EnergyHourlyRow {
  ts: number;
  avgPowerKw: number;
  energyKwh: number;
}

export interface EnergyOverview {
  from: string;
  to: string;
  source: "timescale";
  spanHours: number;
  totalKwh: number;
  avgPowerKw: number;
  assets: EnergyAssetRow[];
  hourly: EnergyHourlyRow[];
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
export type UserRole = "observer" | "operator" | "admin";

export interface AuditRecord {
  id: number;
  at: string;
  actor: string;
  role?: UserRole | string;
  action: string;
  entityType: string;
  entityId?: string;
  detail?: Record<string, unknown>;
}

export type WsServerMessage =
    | { type: "hello"; service: string; mqttUrl: string; embeddedMqtt: boolean }
    | { type: "snapshot"; assets: TelemetryPayload[] }
    | { type: "telemetry"; data: TelemetryPayload }
    | { type: "status"; mqttConnected: boolean }
    | { type: "alarm"; data: AlarmRecord }
    | { type: "alarms_snapshot"; alarms: AlarmRecord[] }
    | { type: "history_snapshot"; series: HistorySeries[] }
    | { type: "auth_ok"; username: string; role: UserRole }
    | { type: "auth_error"; error: string }
    | { type: "ack_error"; alarmId?: string; error: string };

export type WsClientMessage =
  | { type: "auth"; token: string }
  | { type: "alarm_ack"; alarmId: string; ackedBy?: string };
