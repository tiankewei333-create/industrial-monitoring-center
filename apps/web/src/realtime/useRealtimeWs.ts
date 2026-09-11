import { useEffect, useMemo, useRef, useState } from "react";
import { HISTORY_DEFAULTS, type AlarmRecord, type HistorySample, type HistorySeries, type TelemetryPayload, type WsClientMessage, type WsServerMessage } from "@imc/shared-types";

export type ConnState = "connecting" | "open" | "closed";

function defaultWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

const fromEnv = String(import.meta.env.VITE_WS_URL ?? "").trim();
const WS_URL = fromEnv || defaultWsUrl();

export function useRealtimeWs() {
  const [conn, setConn] = useState<ConnState>("connecting");
  const [mqttConnected, setMqttConnected] = useState(false);
  const [hello, setHello] = useState("");
  const [assets, setAssets] = useState<Record<string, TelemetryPayload>>({});
  const [alarmsById, setAlarmsById] = useState<Record<string, AlarmRecord>>({});
  const [historyByAsset, setHistoryByAsset] = useState<Record<string, HistorySample[]>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | undefined;
    let ws: WebSocket | null = null;

    const connect = () => {
      setConn("connecting");
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        setConn("open");
      };

      ws.onclose = () => {
        if (disposed) return;
        setConn("closed");
        setMqttConnected(false);
        wsRef.current = null;
        retryTimer = window.setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onmessage = (ev) => {
        let msg: WsServerMessage;
        try {
          msg = JSON.parse(String(ev.data)) as WsServerMessage;
        } catch {
          return;
        }

        if (msg.type === "hello") {
          setHello(
            `${msg.service} · ${msg.embeddedMqtt ? "embedded MQTT" : "external MQTT"} · ${msg.mqttUrl}`,
          );
        } else if (msg.type === "status") {
          setMqttConnected(msg.mqttConnected);
        } else if (msg.type === "snapshot") {
          const next: Record<string, TelemetryPayload> = {};
          for (const a of msg.assets) next[a.assetId] = a;
          setAssets(next);
        } else if (msg.type === "telemetry") {
          setAssets((prev) => ({ ...prev, [msg.data.assetId]: msg.data }));
          setHistoryByAsset((prev) =>
            appendSample(prev, msg.data.assetId, {
              ts: msg.data.ts,
              temperature: msg.data.metrics.temperature,
              speed: msg.data.metrics.speed,
              power: msg.data.metrics.power,
              status: msg.data.status,
            }),
          );
          setMqttConnected(true);
        } else if (msg.type === "alarms_snapshot") {
          const next: Record<string, AlarmRecord> = {};
          for (const a of msg.alarms) next[a.alarmId] = a;
          setAlarmsById(next);
        } else if (msg.type === "alarm") {
          setAlarmsById((prev) => ({ ...prev, [msg.data.alarmId]: msg.data }));
        } else if (msg.type === "history_snapshot") {
          setHistoryByAsset(seriesToMap(msg.series));
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      ws?.close();
      wsRef.current = null;
    };
  }, []);

  const alarms = useMemo(
    () =>
      Object.values(alarmsById).sort((a, b) => b.raisedAt - a.raisedAt),
    [alarmsById],
  );

  const activeCount = useMemo(
    () => alarms.filter((a) => a.state === "ACTIVE").length,
    [alarms],
  );

  function send(msg: WsClientMessage) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }

  function ackAlarm(alarmId: string, ackedBy: string) {
    return send({ type: "alarm_ack", alarmId, ackedBy });
  }

  return {
    conn,
    mqttConnected,
    hello,
    assets,
    alarms,
    activeCount,
    historyByAsset,
    ackAlarm,
  };
}

function seriesToMap(series: HistorySeries[]): Record<string, HistorySample[]> {
  const next: Record<string, HistorySample[]> = {};
  for (const s of series) next[s.assetId] = s.samples;
  return next;
}

function appendSample(
  prev: Record<string, HistorySample[]>,
  assetId: string,
  sample: HistorySample,
): Record<string, HistorySample[]> {
  const list = prev[assetId] ? [...prev[assetId]] : [];
  const last = list[list.length - 1];
  if (last && last.ts === sample.ts) {
    list[list.length - 1] = sample;
  } else {
    list.push(sample);
  }
  if (list.length > HISTORY_DEFAULTS.maxPoints) {
    list.splice(0, list.length - HISTORY_DEFAULTS.maxPoints);
  }
  return { ...prev, [assetId]: list };
}
