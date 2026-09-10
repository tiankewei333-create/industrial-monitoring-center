import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TelemetryPayload } from "@imc/shared-types";
import { clearSession, getSession } from "../../auth/authStorage";
import "./LivePanel.css";

type ConnState = "connecting" | "open" | "closed";

type ServerMessage =
  | { type: "hello"; service: string; mqttUrl: string; embeddedMqtt: boolean }
  | { type: "snapshot"; assets: TelemetryPayload[] }
  | { type: "telemetry"; data: TelemetryPayload }
  | { type: "status"; mqttConnected: boolean };

const WS_URL =
  import.meta.env.VITE_WS_URL ?? `ws://${window.location.hostname}:3002/ws`;

export function LivePanelPage() {
  const navigate = useNavigate();
  const session = getSession();
  const [conn, setConn] = useState<ConnState>("connecting");
  const [mqttConnected, setMqttConnected] = useState(false);
  const [hello, setHello] = useState("");
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

  function onLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="live-page">
      <header className="live-top">
        <div>
          <div className="live-brand">IMC</div>
          <h1>Industrial Monitoring Center</h1>
          <p className="live-sub">Workshop A · MQTT → Realtime → WebSocket</p>
        </div>
        <div className="live-right">
          <div className="live-badges">
            <span className={`live-badge ${conn === "open" ? "ok" : "bad"}`}>
              WS {conn}
            </span>
            <span className={`live-badge ${mqttConnected ? "ok" : "bad"}`}>
              MQTT {mqttConnected ? "live" : "down"}
            </span>
          </div>
          {session ? (
            <div className="live-user">
              <span>
                {session.user.displayName}
                <em>({session.user.role})</em>
              </span>
              <button type="button" className="live-logout" onClick={onLogout}>
                退出
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {hello ? <p className="live-meta">{hello}</p> : null}

      {list.length === 0 ? (
        <div className="live-empty">
          等待遥测… 请先启动 <code>npm run dev:realtime</code> 与{" "}
          <code>npm run dev:simulator</code>
        </div>
      ) : (
        <div className="live-grid">
          {list.map((a) => (
            <article key={a.assetId} className="live-card">
              <div className="live-card-head">
                <h2>{a.assetId}</h2>
                <span className={`live-status live-status-${a.status.toLowerCase()}`}>
                  {a.status}
                </span>
              </div>
              <div className="live-metrics">
                <Metric
                  label="Temperature"
                  value={`${a.metrics.temperature.toFixed(1)} °C`}
                  hot={a.metrics.temperature >= 80}
                />
                <Metric label="Speed" value={`${a.metrics.speed} rpm`} />
                <Metric
                  label="Power"
                  value={`${a.metrics.power.toFixed(2)} kW`}
                />
              </div>
              <div className="live-ts">
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
    <div className={`live-metric ${hot ? "hot" : ""}`}>
      <div className="live-label">{label}</div>
      <div className="live-value">{value}</div>
    </div>
  );
}
