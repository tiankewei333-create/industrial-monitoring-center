import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../../auth/authStorage";
import { useRealtimeWs } from "../../realtime/useRealtimeWs";
import { FloorPlan } from "../TwinPage/FloorPlan";
import "./WallPage.css";

export function WallPage() {
  const navigate = useNavigate();
  const session = getSession();
  const { conn, mqttConnected, assets, alarms, activeCount } = useRealtimeWs();

  const list = useMemo(
    () => Object.values(assets).sort((a, b) => a.assetId.localeCompare(b.assetId)),
    [assets],
  );
  const openAlarms = useMemo(
    () => alarms.filter((a) => a.state === "ACTIVE" || a.state === "ACKED"),
    [alarms],
  );
  const activeAlarmIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of openAlarms) set.add(a.assetId);
    return set;
  }, [openAlarms]);
  const faultCount = list.filter((a) => a.status === "FAULT").length;
  const offlineCount = list.filter((a) => a.status === "OFFLINE").length;

  return (
    <div className="wall-page">
      <header className="wall-top">
        <div>
          <div className="wall-brand">IMC WALLBOARD</div>
          <h1>Workshop A</h1>
        </div>
        <div className="wall-stats">
          <span className={conn === "open" ? "ok" : "bad"}>WS {conn}</span>
          <span className={mqttConnected ? "ok" : "bad"}>
            MQTT {mqttConnected ? "live" : "down"}
          </span>
          <strong>{list.length} assets</strong>
          <strong className={activeCount ? "hot" : undefined}>
            {activeCount} ACTIVE
          </strong>
          <strong>{faultCount} FAULT</strong>
          <strong>{offlineCount} OFFLINE</strong>
        </div>
        <div className="wall-actions">
          <Link to="/live">Console</Link>
          {session ? (
            <button
              type="button"
              onClick={() => {
                clearSession();
                navigate("/login", { replace: true });
              }}
            >
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      <div className="wall-grid">
        <FloorPlan
          liveByAsset={assets}
          selectedId={null}
          activeAlarmIds={activeAlarmIds}
          onSelect={(id) => navigate(`/twin?asset=${encodeURIComponent(id)}`)}
        />
        <aside className="wall-side">
          <h2>Open alarms</h2>
          {openAlarms.length === 0 ? (
            <p className="wall-empty">No open alarms</p>
          ) : (
            <ul>
              {openAlarms.slice(0, 12).map((a) => (
                <li key={a.alarmId}>
                  <span className={`st st-${a.state.toLowerCase()}`}>{a.state}</span>
                  <code>{a.assetId}</code>
                  {a.rule}
                </li>
              ))}
            </ul>
          )}
          <h2>Assets</h2>
          <ul className="wall-assets">
            {list.map((a) => (
              <li key={a.assetId}>
                <code>{a.assetId}</code>
                <span className={`st st-${a.status.toLowerCase()}`}>{a.status}</span>
                {a.metrics.temperature.toFixed(0)}°C · {a.metrics.power.toFixed(1)} kW
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
