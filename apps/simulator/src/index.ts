import mqtt from "mqtt";
import {
  MQTT_TOPICS,
  WORKSHOP_ASSET_IDS,
  type AssetStatus,
  type TelemetryPayload,
} from "@imc/shared-types";

const args = parseArgs(process.argv.slice(2));

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
const MQTT_USERNAME =
  process.env.MQTT_USERNAME?.trim() || process.env.MQTT_USER?.trim() || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD?.trim() || "";
const PRIMARY_ASSET = process.env.ASSET_ID ?? "Machine001";
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS ?? 1000);
const FLEET_ALL =
  args.fleet === "all" ||
  args.fleet === true ||
  (process.env.SIM_FLEET ?? "all").toLowerCase() === "all";

const FORCE_TEMP = firstNumber(args["force-temp"], process.env.SIM_FORCE_TEMP);
const FORCE_POWER = firstNumber(args["force-power"], process.env.SIM_FORCE_POWER);
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

type Device = {
  assetId: string;
  temperature: number;
  speed: number;
  power: number;
  status: AssetStatus;
  tick: number;
};

const BASE: Record<string, { t: number; speed: number; power: number }> = {
  Machine001: { t: 72, speed: 2400, power: 11.5 },
  Machine002: { t: 66, speed: 1850, power: 9.2 },
  Robot001: { t: 41, speed: 35, power: 3.1 },
  Robot002: { t: 39, speed: 28, power: 2.4 },
  Conveyor001: { t: 34, speed: 18, power: 4.6 },
  Sensor001: { t: 28, speed: 0, power: 0.08 },
  Warehouse001: { t: 22, speed: 0, power: 0.4 },
  Energy001: { t: 31, speed: 0, power: 12.0 },
};

const assetIds = FLEET_ALL ? [...WORKSHOP_ASSET_IDS] : [PRIMARY_ASSET];
const devices: Device[] = assetIds.map((assetId) => {
  const base = BASE[assetId] ?? { t: 50, speed: 100, power: 2 };
  return {
    assetId,
    temperature: base.t,
    speed: base.speed,
    power: base.power,
    status: "RUNNING",
    tick: 0,
  };
});

const startedAt = Date.now();

function nextPayload(dev: Device): TelemetryPayload {
  dev.tick += 1;
  const base = BASE[dev.assetId] ?? { t: 50, speed: 100, power: 2 };
  const isPrimary = dev.assetId === PRIMARY_ASSET;

  dev.speed = clamp(dev.speed + rand(-base.speed * 0.02, base.speed * 0.02), 0, base.speed * 1.4);
  dev.power = clamp(dev.power + rand(-0.15, 0.2), 0, Math.max(20, base.power * 1.5));

  if (isPrimary && FORCE_POWER !== undefined) {
    dev.power = FORCE_POWER;
  }

  if (isPrimary && FORCE_TEMP !== undefined) {
    dev.temperature = FORCE_TEMP;
    dev.status =
      FORCE_TEMP > 80
        ? "FAULT"
        : ((process.env.SIM_FORCE_STATUS as AssetStatus) || "RUNNING");
  } else if (isPrimary && SPIKE_ENABLED) {
    applySpikeCycle(dev);
  } else {
    dev.temperature = clamp(dev.temperature + rand(-0.4, 0.5), base.t - 8, base.t + 12);
    if (dev.tick % (40 + assetIds.indexOf(dev.assetId) * 7) === 0) {
      dev.status = "FAULT";
      if (isPrimary) dev.temperature = 86 + rand(0, 3);
    } else if (dev.tick % (40 + assetIds.indexOf(dev.assetId) * 7) === 6) {
      dev.status = "RUNNING";
    } else if (process.env.SIM_FORCE_STATUS && isPrimary) {
      dev.status = process.env.SIM_FORCE_STATUS as AssetStatus;
    }
  }

  return {
    assetId: dev.assetId,
    ts: Date.now(),
    metrics: {
      temperature: round(dev.temperature, 1),
      speed: Math.round(dev.speed),
      power: round(dev.power, 2),
    },
    status: dev.status,
  };
}

function applySpikeCycle(dev: Device) {
  const elapsedSec = (Date.now() - startedAt) / 1000;
  const cycle = SPIKE_SEC + COOL_SEC;
  const phase = elapsedSec % cycle;
  const hot = phase < SPIKE_SEC;
  if (hot) {
    dev.temperature = SPIKE_TEMP + rand(-0.3, 0.3);
    dev.status = "FAULT";
  } else {
    dev.temperature = COOL_TEMP + rand(-0.5, 0.5);
    dev.status = (process.env.SIM_FORCE_STATUS as AssetStatus) || "RUNNING";
  }
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const body = raw.slice(2);
    const eq = body.indexOf("=");
    if (eq === -1) out[body] = true;
    else out[body.slice(0, eq)] = body.slice(eq + 1);
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
  const bits = [`fleet=${assetIds.join(",")}`];
  if (FORCE_TEMP !== undefined) bits.push(`FORCE_TEMP=${FORCE_TEMP}°C@${PRIMARY_ASSET}`);
  if (FORCE_POWER !== undefined) bits.push(`FORCE_POWER=${FORCE_POWER}kW@${PRIMARY_ASSET}`);
  if (SPIKE_ENABLED) {
    bits.push(
      `SPIKE ${SPIKE_TEMP}°C×${SPIKE_SEC}s / cool ${COOL_TEMP}°C×${COOL_SEC}s @${PRIMARY_ASSET}`,
    );
  }
  return bits.join(" · ");
}

const client = mqtt.connect(MQTT_URL, {
  clientId: `imc-simulator-${process.pid}`,
  reconnectPeriod: 2000,
  connectTimeout: 10_000,
  ...(MQTT_USERNAME && MQTT_PASSWORD
    ? { username: MQTT_USERNAME, password: MQTT_PASSWORD }
    : {}),
});

client.on("connect", () => {
  console.log(`[simulator] connected ${MQTT_URL}${MQTT_USERNAME ? ` as ${MQTT_USERNAME}` : ""}`);
  console.log(`[simulator] ${describeMode()} every ${INTERVAL_MS}ms`);
});

client.on("reconnect", () => {
  console.log(`[simulator] reconnecting to ${MQTT_URL}...`);
});

client.on("error", (err) => {
  console.error(`[simulator] mqtt error: ${err.message}`);
});

let ticks = 0;
const timer = setInterval(() => {
  if (!client.connected) return;
  ticks += 1;
  for (const dev of devices) {
    const payload = nextPayload(dev);
    const topic = MQTT_TOPICS.telemetryAsset(payload.assetId);
    client.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
      if (err) console.error(`[simulator] publish failed ${payload.assetId}: ${err.message}`);
    });
  }
  if (ticks % 10 === 1) {
    const summary = devices
      .map((d) => `${d.assetId}:${d.status}/T${round(d.temperature, 0)}`)
      .join(" ");
    console.log(`[simulator] ${summary}`);
  }
}, INTERVAL_MS);

function shutdown() {
  clearInterval(timer);
  client.end(true, {}, () => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
