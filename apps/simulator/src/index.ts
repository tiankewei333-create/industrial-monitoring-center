import mqtt from "mqtt";
import {
  MQTT_TOPICS,
  type AssetStatus,
  type TelemetryPayload,
} from "@imc/shared-types";

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
const ASSET_ID = process.env.ASSET_ID ?? "Machine001";
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS ?? 1000);

let temperature = 72;
let speed = 2400;
let power = 11.5;
let status: AssetStatus = "RUNNING";
let tick = 0;

function nextPayload(): TelemetryPayload {
  tick += 1;

  // Gentle drift + occasional spike so the UI is visibly "live"
  temperature = clamp(temperature + rand(-0.8, 1.2), 40, 95);
  speed = clamp(speed + rand(-40, 40), 0, 3000);
  power = clamp(power + rand(-0.4, 0.5), 0, 20);

  if (tick % 45 === 0) {
    status = "FAULT";
    temperature = 86 + rand(0, 4);
  } else if (tick % 45 === 8) {
    status = "RUNNING";
  } else if (process.env.SIM_FORCE_STATUS) {
    status = process.env.SIM_FORCE_STATUS as AssetStatus;
  }

  return {
    assetId: ASSET_ID,
    ts: Date.now(),
    metrics: {
      temperature: round(temperature, 1),
      speed: Math.round(speed),
      power: round(power, 2),
    },
    status,
  };
}

function round(n: number, digits: number) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

const topic = MQTT_TOPICS.telemetryAsset(ASSET_ID);
const client = mqtt.connect(MQTT_URL, {
  clientId: `imc-simulator-${ASSET_ID}-${process.pid}`,
  reconnectPeriod: 2000,
  connectTimeout: 10_000,
});

client.on("connect", () => {
  console.log(`[simulator] connected ${MQTT_URL}`);
  console.log(`[simulator] publishing ${topic} every ${INTERVAL_MS}ms`);
});

client.on("reconnect", () => {
  console.log(`[simulator] reconnecting to ${MQTT_URL}...`);
});

client.on("error", (err) => {
  console.error(`[simulator] mqtt error: ${err.message}`);
});

const timer = setInterval(() => {
  if (!client.connected) return;
  const payload = nextPayload();
  client.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
    if (err) {
      console.error(`[simulator] publish failed: ${err.message}`);
      return;
    }
    console.log(
      `[simulator] ${payload.assetId} ${payload.status} T=${payload.metrics.temperature}°C P=${payload.metrics.power}kW`,
    );
  });
}, INTERVAL_MS);

function shutdown() {
  clearInterval(timer);
  client.end(true, {}, () => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
