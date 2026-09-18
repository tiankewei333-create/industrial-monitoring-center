import http from "node:http";
import net from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import aedes from "aedes";
import mqtt from "mqtt";
import {
  MQTT_TOPICS,
  type TelemetryPayload,
  type UserRole,
  type WsClientMessage,
  type WsServerMessage,
} from "@imc/shared-types";
import {
  acknowledgeAlarm,
  applyThresholdConfig,
  evaluateOffline,
  evaluateTelemetry,
  getAlarm,
  hydrateAlarms,
  listAlarms,
  openAlarmCount,
  resolvedThresholds,
} from "./alarms.js";
import {
  initDb,
  loadAlarmsFromDb,
  loadThresholdConfig,
  touchAssetStatus,
  upsertAlarm,
  writeAudit,
  dbEnabled,
} from "./db.js";
import { assertJwtSecret } from "./hardening.js";
import { verifyAccessToken } from "./jwt.js";
import {
  appendHistory,
  getHistory,
  historyMaxPoints,
  historyPointCount,
  listHistorySeries,
} from "./history.js";
import { enqueueTelemetry, initTimescale, timescaleEnabled } from "./timescale.js";

const PORT = Number(process.env.PORT ?? process.env.REALTIME_PORT ?? 3002);
const EMBED_MQTT = (process.env.IMC_EMBED_MQTT ?? "true").toLowerCase() !== "false";
const MQTT_HOST = process.env.MQTT_HOST ?? "127.0.0.1";
const MQTT_PORT = Number(process.env.MQTT_BROKER_PORT ?? 1883);
const MQTT_URL = EMBED_MQTT
  ? `mqtt://${MQTT_HOST}:${MQTT_PORT}`
  : (process.env.MQTT_URL ?? `mqtt://${MQTT_HOST}:${MQTT_PORT}`);
const TELEMETRY_TOPIC = process.env.MQTT_TOPIC_TELEMETRY ?? `${MQTT_TOPICS.telemetry}/#`;

/** latest payload per asset — sent to new WS clients on connect */
const latestByAsset = new Map<string, TelemetryPayload>();
const lastSeenByAsset = new Map<string, number>();
const sockets = new Set<WebSocket>();
const wsUsers = new WeakMap<WebSocket, { username: string; role: UserRole }>();
const OFFLINE_TICK_MS = 2000;
const THRESHOLD_REFRESH_MS = 5000;
let mqttMessages = 0;

async function startEmbeddedBroker() {
  // aedes CJS default is callable; published types prefer createBroker (not a runtime export).
  const broker = (aedes as unknown as () => {
    handle: (socket: net.Socket) => void;
    on: (event: "client", listener: (client: { id: string }) => void) => void;
  })();
  const server = net.createServer(broker.handle);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(MQTT_PORT, MQTT_HOST, () => resolve());
  });

  console.log(`[realtime] embedded MQTT broker on mqtt://${MQTT_HOST}:${MQTT_PORT}`);
  broker.on("client", (client) => {
    console.log(`[realtime] mqtt client connected: ${client.id}`);
  });

  return { broker, server };
}

function broadcast(msg: WsServerMessage) {
  const raw = JSON.stringify(msg);
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(raw);
  }
}

function send(ws: WebSocket, msg: WsServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function handleTelemetry(raw: string) {
  let data: TelemetryPayload;
  try {
    data = JSON.parse(raw) as TelemetryPayload;
  } catch {
    console.warn("[realtime] invalid JSON telemetry, ignored");
    return;
  }

  if (!data?.assetId || !data?.metrics || !data?.status) {
    console.warn("[realtime] malformed telemetry, ignored");
    return;
  }

  latestByAsset.set(data.assetId, data);
  lastSeenByAsset.set(data.assetId, data.ts || Date.now());
  mqttMessages += 1;
  appendHistory(data);
  enqueueTelemetry(data);
  broadcast({ type: "telemetry", data });
  void touchAssetStatus(data);

  const thresholds = resolvedThresholds(data.assetId);
  const changed = [
    ...evaluateTelemetry(data, thresholds),
    ...evaluateOffline(data.assetId, 0, thresholds.offlineTimeoutSec),
  ];
  for (const alarm of changed) {
    broadcast({ type: "alarm", data: alarm });
    void upsertAlarm(alarm);
  }
}

async function handleClientMessage(ws: WebSocket, raw: string) {
  let msg: WsClientMessage;
  try {
    msg = JSON.parse(raw) as WsClientMessage;
  } catch {
    console.warn("[realtime] invalid WS client JSON, ignored");
    return;
  }

  if (msg?.type === "auth") {
    const claims = await verifyAccessToken(String(msg.token ?? ""));
    if (!claims?.sub || !claims.role) {
      send(ws, { type: "auth_error", error: "unauthorized" });
      return;
    }
    const role = claims.role as UserRole;
    wsUsers.set(ws, { username: claims.sub, role });
    send(ws, { type: "auth_ok", username: claims.sub, role });
    return;
  }

  if (msg?.type !== "alarm_ack" || !msg.alarmId) {
    console.warn("[realtime] unsupported WS client message, ignored");
    return;
  }

  const user = wsUsers.get(ws);
  if (!user) {
    send(ws, { type: "ack_error", alarmId: msg.alarmId, error: "unauthorized" });
    return;
  }
  if (user.role === "observer") {
    send(ws, { type: "ack_error", alarmId: msg.alarmId, error: "forbidden" });
    return;
  }

  const existing = getAlarm(msg.alarmId);
  const live = existing ? latestByAsset.get(existing.assetId) : undefined;
  const lastSeen = existing ? lastSeenByAsset.get(existing.assetId) : undefined;
  const result = acknowledgeAlarm(msg.alarmId, user.username, {
    temperature: live?.metrics.temperature,
    power: live?.metrics.power,
    online: existing
      ? lastSeen !== undefined
        ? Date.now() - lastSeen <=
          resolvedThresholds(existing.assetId).offlineTimeoutSec * 1000
        : live?.status !== "OFFLINE"
      : false,
  });

  if ("error" in result) {
    send(ws, { type: "ack_error", alarmId: msg.alarmId, error: result.error });
    console.warn(`[realtime] alarm_ack rejected: ${result.error} id=${msg.alarmId}`);
    return;
  }

  void upsertAlarm(result);
  void writeAudit({
    actor: user.username,
    role: user.role,
    action: "alarm_ack",
    entityType: "alarm",
    entityId: result.alarmId,
    detail: { state: result.state, rule: result.rule, assetId: result.assetId },
  });
  broadcast({ type: "alarm", data: result });
}

function tickOffline() {
  const now = Date.now();
  for (const [assetId, seen] of lastSeenByAsset) {
    const thresholds = resolvedThresholds(assetId);
    const ageSec = (now - seen) / 1000;
    const changed = evaluateOffline(
      assetId,
      ageSec,
      thresholds.offlineTimeoutSec,
      now,
    );

    if (ageSec > thresholds.offlineTimeoutSec) {
      const latest = latestByAsset.get(assetId);
      if (latest && latest.status !== "OFFLINE") {
        const offline: TelemetryPayload = {
          ...latest,
          status: "OFFLINE",
          ts: now,
        };
        latestByAsset.set(assetId, offline);
        broadcast({ type: "telemetry", data: offline });
        void touchAssetStatus(offline);
      }
    }

    for (const alarm of changed) {
      broadcast({ type: "alarm", data: alarm });
      void upsertAlarm(alarm);
    }
  }
}

async function refreshThresholds() {
  try {
    const cfg = await loadThresholdConfig();
    if (!cfg) return;
    applyThresholdConfig(cfg.global, cfg.overrides);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[realtime] threshold refresh failed: ${message}`);
  }
}

function connectMqttBridge() {
  const client = mqtt.connect(MQTT_URL, {
    clientId: `imc-realtime-bridge-${process.pid}`,
    reconnectPeriod: 2000,
    ...(process.env.MQTT_USERNAME?.trim() || process.env.MQTT_USER?.trim()
      ? {
          username:
            process.env.MQTT_USERNAME?.trim() || process.env.MQTT_USER?.trim(),
          password: process.env.MQTT_PASSWORD?.trim() || "",
        }
      : {}),
  });

  client.on("connect", () => {
    console.log(`[realtime] subscribed bridge → ${MQTT_URL} topic=${TELEMETRY_TOPIC}`);
    client.subscribe(TELEMETRY_TOPIC, (err) => {
      if (err) console.error(`[realtime] subscribe failed: ${err.message}`);
    });
    broadcast({ type: "status", mqttConnected: true });
  });

  client.on("reconnect", () => {
    console.log("[realtime] mqtt bridge reconnecting...");
    broadcast({ type: "status", mqttConnected: false });
  });

  client.on("close", () => {
    broadcast({ type: "status", mqttConnected: false });
  });

  client.on("error", (err) => {
    console.error(`[realtime] mqtt bridge error: ${err.message}`);
  });

  client.on("message", (_topic, payload) => {
    handleTelemetry(payload.toString("utf8"));
  });

  return client;
}

function startHttpAndWs() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "imc-realtime",
          assets: latestByAsset.size,
          alarms: listAlarms().length,
          openAlarms: openAlarmCount(),
          historyPoints: historyPointCount(),
          historyMaxPoints: historyMaxPoints(),
          postgres: dbEnabled(),
          timescale: timescaleEnabled(),
          clients: sockets.size,
          mqttUrl: MQTT_URL,
          embeddedMqtt: EMBED_MQTT,
        }),
      );
      return;
    }

    if (url.pathname === "/metrics") {
      const body = [
        `# HELP imc_mqtt_messages_total Telemetry messages processed`,
        `# TYPE imc_mqtt_messages_total counter`,
        `imc_mqtt_messages_total ${mqttMessages}`,
        `# HELP imc_ws_clients Open WebSocket clients`,
        `# TYPE imc_ws_clients gauge`,
        `imc_ws_clients ${sockets.size}`,
        `# HELP imc_open_alarms Open (ACTIVE+ACKED) alarms`,
        `# TYPE imc_open_alarms gauge`,
        `imc_open_alarms ${openAlarmCount()}`,
        `# HELP imc_assets_seen Assets with a latest sample`,
        `# TYPE imc_assets_seen gauge`,
        `imc_assets_seen ${latestByAsset.size}`,
        "",
      ].join("\n");
      res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
      res.end(body);
      return;
    }

    if (url.pathname === "/history") {
      const assetId = url.searchParams.get("assetId");
      const payload = assetId
        ? { assetId, samples: getHistory(assetId) }
        : { series: listHistorySeries() };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("imc-realtime: use WebSocket or GET /health");
  });

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    sockets.add(ws);
    send(ws, {
      type: "hello",
      service: "imc-realtime",
      mqttUrl: MQTT_URL,
      embeddedMqtt: EMBED_MQTT,
    });
    send(ws, {
      type: "snapshot",
      assets: [...latestByAsset.values()],
    });
    send(ws, {
      type: "alarms_snapshot",
      alarms: listAlarms(),
    });
    send(ws, {
      type: "history_snapshot",
      series: listHistorySeries(),
    });

    ws.on("message", (data) => {
      void handleClientMessage(ws, data.toString("utf8"));
    });
    ws.on("close", () => sockets.delete(ws));
  });

  server.listen(PORT, () => {
    console.log(`[realtime] http://127.0.0.1:${PORT}/health`);
    console.log(`[realtime] ws://127.0.0.1:${PORT}/ws`);
  });

  return server;
}

async function main() {
  assertJwtSecret();

  try {
    await initDb();
    if (dbEnabled()) {
      const rows = await loadAlarmsFromDb();
      hydrateAlarms(rows);
      await refreshThresholds();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[realtime] postgres init failed (${message}); continuing in-memory`);
  }

  try {
    await initTimescale();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[realtime] timescale init failed (${message}); memory history only`);
  }

  if (EMBED_MQTT) {
    try {
      await startEmbeddedBroker();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[realtime] embed MQTT failed (${message}); will use existing broker at ${MQTT_URL}`,
      );
    }
  } else {
    console.log(`[realtime] IMC_EMBED_MQTT=false → using external broker ${MQTT_URL}`);
  }

  connectMqttBridge();
  startHttpAndWs();
  setInterval(tickOffline, OFFLINE_TICK_MS);
  if (dbEnabled()) {
    setInterval(() => {
      void refreshThresholds();
    }, THRESHOLD_REFRESH_MS);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
