import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../../auth/authStorage";
import { useRealtimeWs } from "../../realtime/useRealtimeWs";
import { Sparkline } from "../HistoryPage/Sparkline";
import "./LivePanel.css";

export function LivePanelPage() {
  const navigate = useNavigate();
  const session = getSession();
  const { conn, mqttConnected, hello, assets, activeCount, historyByAsset } =
    useRealtimeWs();

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
          <nav className="live-nav" aria-label="Primary">
            <span className="live-nav-current" aria-current="page">
              Live panel
            </span>
            <Link to="/assets">Assets</Link>
            <Link to="/alarms" className="live-nav-alarms">
              Alarms
              {activeCount > 0 ? (
                <span className="live-nav-badge" aria-label={`${activeCount} active`}>
                  {activeCount}
                </span>
              ) : null}
            </Link>
            <Link to="/work-orders">Work orders</Link>
            <Link to="/history">History</Link>
            <Link to="/kpi">KPI</Link>
            <Link to="/twin">Twin</Link>
          </nav>
          <div className="live-badges">
            <span className={`live-badge ${conn === "open" ? "ok" : "bad"}`}>
              WS {conn}
            </span>
            <span className={`live-badge ${mqttConnected ? "ok" : "bad"}`}>
              MQTT {mqttConnected ? "live" : "down"}
            </span>
            {activeCount > 0 ? (
              <Link to="/alarms" className="live-badge alarm">
                {activeCount} ACTIVE
              </Link>
            ) : null}
          </div>
          {session ? (
            <div className="live-user">
              <span>
                {session.user.displayName}
                <em>({session.user.role})</em>
              </span>
              <button type="button" className="live-logout" onClick={onLogout}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {hello ? <p className="live-meta">{hello}</p> : null}

      {list.length === 0 ? (
        <div className="live-empty">
          Waiting for telemetry… start <code>npm run dev:realtime</code> and{" "}
          <code>npm run dev:simulator</code>
        </div>
      ) : (
        <div className="live-grid">
          {list.map((a) => (
            <article key={a.assetId} className="live-card">
              <div className="live-card-head">
                <h2>
                  <Link to={`/history?asset=${encodeURIComponent(a.assetId)}`}>
                    {a.assetId}
                  </Link>
                </h2>
                <span className={`live-status live-status-${a.status.toLowerCase()}`}>
                  {a.status}
                </span>
              </div>
              <Sparkline
                values={(historyByAsset[a.assetId] ?? []).slice(-80).map((s) => s.temperature)}
                hot={a.metrics.temperature >= 80}
              />
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
