import mqtt from "mqtt";
import {
  MQTT_TOPICS,
  type AssetStatus,
  type TelemetryPayload,
} from "@imc/shared-types";

const args = parseArgs(process.argv.slice(2));

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
const ASSET_ID = process.env.ASSET_ID ?? "Machine001";
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS ?? 1000);

/** Hold temperature at a fixed °C (e.g. 86). Overrides drift / spike. */
const FORCE_TEMP = firstNumber(
  args["force-temp"],
  process.env.SIM_FORCE_TEMP,
);

/**
 * Cyclic over-temp for alarm demo:
 * hot for spike-sec, then cool for cool-sec, repeat.
 */
const SPIKE_ENABLED =
  args.spike === true ||
  (process.env.SIM_SPIKE ?? "false").toLowerCase() === "true";
const SPIKE_TEMP = firstNumber(args["spike-temp"], process.env.SIM_SPIKE_TEMP) ?? 86;
const SPIKE_SEC = Math.max(
  1,
  firstNumber(args["spike-sec"], process.env.SIM_SPIKE_SEC) ?? 15,
);
const COOL_SEC = Math.max(
  1,
  firstNumber(args["cool-sec"], process.env.SIM_COOL_SEC) ?? 20,
);
const COOL_TEMP = firstNumber(args["cool-temp"], process.env.SIM_COOL_TEMP) ?? 72;

let temperature = 72;
let speed = 2400;
let power = 11.5;
let status: AssetStatus = "RUNNING";
let tick = 0;
const startedAt = Date.now();

function nextPayload(): TelemetryPayload {
  tick += 1;

  speed = clamp(speed + rand(-40, 40), 0, 3000);
  power = clamp(power + rand(-0.4, 0.5), 0, 20);

  if (FORCE_TEMP !== undefined) {
    temperature = FORCE_TEMP;
    status =
      FORCE_TEMP > 80
        ? "FAULT"
        : ((process.env.SIM_FORCE_STATUS as AssetStatus) || "RUNNING");
  } else if (SPIKE_ENABLED) {
    applySpikeCycle();
  } else {
    // Gentle drift + occasional spike so the UI is visibly "live"
    temperature = clamp(temperature + rand(-0.8, 1.2), 40, 95);

    if (tick % 45 === 0) {
      status = "FAULT";
      temperature = 86 + rand(0, 4);
    } else if (tick % 45 === 8) {
      status = "RUNNING";
    } else if (process.env.SIM_FORCE_STATUS) {
      status = process.env.SIM_FORCE_STATUS as AssetStatus;
    }
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

function applySpikeCycle() {
  const elapsedSec = (Date.now() - startedAt) / 1000;
  const cycle = SPIKE_SEC + COOL_SEC;
  const phase = elapsedSec % cycle;
  const hot = phase < SPIKE_SEC;

  if (hot) {
    temperature = SPIKE_TEMP + rand(-0.3, 0.3);
    status = "FAULT";
  } else {
    temperature = COOL_TEMP + rand(-0.5, 0.5);
    status = (process.env.SIM_FORCE_STATUS as AssetStatus) || "RUNNING";
  }
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const body = raw.slice(2);
    const eq = body.indexOf("=");
    if (eq === -1) {
      out[body] = true;
    } else {
      out[body.slice(0, eq)] = body.slice(eq + 1);
    }
  }
  return out;
}

function firstNumber(
  ...candidates: Array<string | boolean | undefined>
): number | undefined {
  for (const c of candidates) {
    if (c === undefined || c === true || c === false) continue;
    if (String(c).trim() === "") continue;
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
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

function describeMode(): string {
  if (FORCE_TEMP !== undefined) return `FORCE_TEMP=${FORCE_TEMP}°C`;
  if (SPIKE_ENABLED) {
    return `SPIKE ${SPIKE_TEMP}°C×${SPIKE_SEC}s / cool ${COOL_TEMP}°C×${COOL_SEC}s`;
  }
  return "drift + occasional spike (~45s)";
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
  console.log(`[simulator] mode: ${describeMode()}`);
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
