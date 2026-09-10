import http from "node:http";
import net from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import aedes from "aedes";
import mqtt from "mqtt";
import { MQTT_TOPICS, type TelemetryPayload } from "@imc/shared-types";

const PORT = Number(process.env.PORT ?? process.env.REALTIME_PORT ?? 3002);
const EMBED_MQTT = (process.env.IMC_EMBED_MQTT ?? "true").toLowerCase() !== "false";
const MQTT_HOST = process.env.MQTT_HOST ?? "127.0.0.1";
const MQTT_PORT = Number(process.env.MQTT_BROKER_PORT ?? 1883);
const MQTT_URL = process.env.MQTT_URL ?? `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
const TELEMETRY_TOPIC = process.env.MQTT_TOPIC_TELEMETRY ?? `${MQTT_TOPICS.telemetry}/#`;

/** latest payload per asset — sent to new WS clients on connect */
const latestByAsset = new Map<string, TelemetryPayload>();
const sockets = new Set<WebSocket>();

type WsMessage =
  | { type: "hello"; service: string; mqttUrl: string; embeddedMqtt: boolean }
  | { type: "snapshot"; assets: TelemetryPayload[] }
  | { type: "telemetry"; data: TelemetryPayload }
  | { type: "status"; mqttConnected: boolean };

async function startEmbeddedBroker() {
  const broker = aedes();
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

function broadcast(msg: WsMessage) {
  const raw = JSON.stringify(msg);
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(raw);
  }
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
  broadcast({ type: "telemetry", data });
}

function connectMqttBridge() {
  const client = mqtt.connect(MQTT_URL, {
    clientId: `imc-realtime-bridge-${process.pid}`,
    reconnectPeriod: 2000,
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
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "imc-realtime",
          assets: latestByAsset.size,
          clients: sockets.size,
          mqttUrl: MQTT_URL,
          embeddedMqtt: EMBED_MQTT,
        }),
      );
      return;
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("imc-realtime: use WebSocket or GET /health");
  });

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    sockets.add(ws);
    ws.send(
      JSON.stringify({
        type: "hello",
        service: "imc-realtime",
        mqttUrl: MQTT_URL,
        embeddedMqtt: EMBED_MQTT,
      } satisfies WsMessage),
    );
    ws.send(
      JSON.stringify({
        type: "snapshot",
        assets: [...latestByAsset.values()],
      } satisfies WsMessage),
    );

    ws.on("close", () => sockets.delete(ws));
  });

  server.listen(PORT, () => {
    console.log(`[realtime] http://127.0.0.1:${PORT}/health`);
    console.log(`[realtime] ws://127.0.0.1:${PORT}/ws`);
  });

  return server;
}

async function main() {
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
