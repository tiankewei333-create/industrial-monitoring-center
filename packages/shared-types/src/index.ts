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
