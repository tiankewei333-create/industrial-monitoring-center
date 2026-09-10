import { useEffect, useMemo, useState } from "react";
import type { TelemetryPayload } from "@imc/shared-types";

type ConnState = "connecting" | "open" | "closed";

type ServerMessage =
  | { type: "hello"; service: string; mqttUrl: string; embeddedMqtt: boolean }
  | { type: "snapshot"; assets: TelemetryPayload[] }
  | { type: "telemetry"; data: TelemetryPayload }
  | { type: "status"; mqttConnected: boolean };

const WS_URL =
  import.meta.env.VITE_WS_URL ?? `ws://${window.location.hostname}:3002/ws`;

export function App() {
  const [conn, setConn] = useState<ConnState>("connecting");
  const [mqttConnected, setMqttConnected] = useState(false);
  const [hello, setHello] = useState<string>("");
  const [assets, setAssets] = useState<Record<string, TelemetryPayload>>({});

  useEffect(() => {
    let ws: WebSocket | null = null;
    let disposed = false;
    let retryTimer: number | undefined;

    const connect = () => {
      setConn("connecting");
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        if (disposed) return;
        setConn("open");
      };

      ws.onclose = () => {
        if (disposed) return;
        setConn("closed");
        setMqttConnected(false);
        retryTimer = window.setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerMessage;
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
          setMqttConnected(true);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  const list = useMemo(
    () => Object.values(assets).sort((a, b) => a.assetId.localeCompare(b.assetId)),
    [assets],
  );

  return (
    <div className="page">
      <header className="top">
        <div>
          <div className="brand">IMC</div>
          <h1>Industrial Monitoring Center</h1>
          <p className="sub">Workshop A · MQTT → Realtime → WebSocket</p>
        </div>
        <div className="badges">
          <span className={`badge ${conn === "open" ? "ok" : "bad"}`}>
            WS {conn}
          </span>
          <span className={`badge ${mqttConnected ? "ok" : "bad"}`}>
            MQTT {mqttConnected ? "live" : "down"}
          </span>
        </div>
      </header>

      {hello ? <p className="meta">{hello}</p> : null}

      {list.length === 0 ? (
        <div className="empty">
          等待遥测… 请先启动 <code>npm run dev:realtime</code> 与{" "}
          <code>npm run dev:simulator</code>
        </div>
      ) : (
        <div className="grid">
          {list.map((a) => (
            <article key={a.assetId} className="card">
              <div className="card-head">
                <h2>{a.assetId}</h2>
                <span className={`status status-${a.status.toLowerCase()}`}>
                  {a.status}
                </span>
              </div>
              <div className="metrics">
                <Metric
                  label="Temperature"
                  value={`${a.metrics.temperature.toFixed(1)} °C`}
                  hot={a.metrics.temperature >= 80}
                />
                <Metric label="Speed" value={`${a.metrics.speed} rpm`} />
                <Metric label="Power" value={`${a.metrics.power.toFixed(2)} kW`} />
              </div>
              <div className="ts">
                updated {new Date(a.ts).toLocaleTimeString()}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hot,
}: {
  label: string;
  value: string;
  hot?: boolean;
}) {
  return (
    <div className={`metric ${hot ? "hot" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
