import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../../auth/authStorage";
import { useRealtimeWs } from "../../realtime/useRealtimeWs";
import { TWIN_PLACEMENTS } from "./twinLayout";
import { WorkshopScene } from "./WorkshopScene";
import "./TwinPage.css";

export function TwinPage() {
  const navigate = useNavigate();
  const session = getSession();
  const { conn, mqttConnected, assets, alarms, activeCount } = useRealtimeWs();
  const [selectedId, setSelectedId] = useState<string | null>("Machine001");

  const activeAlarmIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of alarms) {
      if (a.state === "ACTIVE" || a.state === "ACKED") set.add(a.assetId);
    }
    return set;
  }, [alarms]);

  const selectedPlacement = TWIN_PLACEMENTS.find((p) => p.assetId === selectedId);
  const live = selectedId ? assets[selectedId] : undefined;

  function onLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="twin-page">
      <header className="twin-top">
        <div>
          <div className="twin-brand">IMC</div>
          <h1>Workshop Twin</h1>
          <p className="twin-sub">
            Workshop A · R3F + glTF · temperature heat shader (40→90°C)
          </p>
        </div>
        <div className="twin-right">
          <nav className="twin-nav" aria-label="Primary">
            <Link to="/live">Live panel</Link>
            <Link to="/assets">Assets</Link>
            <Link to="/alarms">
              Alarms
              {activeCount > 0 ? (
                <span className="twin-nav-badge" aria-label={`${activeCount} active`}>
                  {activeCount}
                </span>
              ) : null}
            </Link>
            <Link to="/work-orders">Work orders</Link>
            <Link to="/history">History</Link>
            <Link to="/kpi">KPI</Link>
            <span className="twin-nav-current" aria-current="page">
              Twin
            </span>
          </nav>
          <div className="twin-badges">
            <span className={`twin-badge ${conn === "open" ? "ok" : "bad"}`}>
              WS {conn}
            </span>
            <span className={`twin-badge ${mqttConnected ? "ok" : "bad"}`}>
              MQTT {mqttConnected ? "live" : "down"}
            </span>
          </div>
          {session ? (
            <div className="twin-user">
              <span>
                {session.user.displayName}
                <em>({session.user.role})</em>
              </span>
              <button type="button" className="twin-logout" onClick={onLogout}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="twin-body">
        <WorkshopScene
          liveByAsset={assets}
          selectedId={selectedId}
          activeAlarmIds={activeAlarmIds}
          onSelect={setSelectedId}
        />

        <aside className="twin-side" aria-label="Asset detail">
          {selectedPlacement ? (
            <>
              <div className="twin-side-head">
                <h2>{selectedPlacement.assetId}</h2>
                <span
                  className={`twin-status twin-status-${(live?.status ?? "OFFLINE").toLowerCase()}`}
                >
                  {live?.status ?? "OFFLINE"}
                </span>
              </div>
              <p className="twin-name">{selectedPlacement.name}</p>
              <p className="twin-type">
                {selectedPlacement.type} · click mesh to select
              </p>

              {live ? (
                <dl className="twin-metrics">
                  <div>
                    <dt>Temperature</dt>
                    <dd className={live.metrics.temperature >= 80 ? "hot" : undefined}>
                      {live.metrics.temperature.toFixed(1)} °C
                    </dd>
                  </div>
                  <div>
                    <dt>Speed</dt>
                    <dd>{live.metrics.speed} rpm</dd>
                  </div>
                  <div>
                    <dt>Power</dt>
                    <dd>{live.metrics.power.toFixed(2)} kW</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{new Date(live.ts).toLocaleTimeString()}</dd>
                  </div>
                </dl>
              ) : (
                <p className="twin-hint">
                  No live telemetry yet for this asset (simulator currently
                  publishes Machine001).
                </p>
              )}

              {selectedId && activeAlarmIds.has(selectedId) ? (
                <p className="twin-alarm-hint">Open alarm on this asset</p>
              ) : null}

              <div className="twin-actions">
                <Link to={`/history?asset=${encodeURIComponent(selectedPlacement.assetId)}`}>
                  History
                </Link>
                <Link to="/alarms">Alarms</Link>
                <Link to="/live">Live</Link>
              </div>
            </>
          ) : (
            <p className="twin-hint">Click a machine in the scene.</p>
          )}

          <div className="twin-legend">
            <div className="twin-heat-legend" aria-label="Temperature heat ramp">
              <span>Heat shader</span>
              <div className="twin-heat-bar" />
              <div className="twin-heat-labels">
                <span>40°C</span>
                <span>80°C thr</span>
                <span>90°C</span>
              </div>
            </div>
            <span>
              <i className="running" /> lamp RUNNING
            </span>
            <span>
              <i className="idle" /> lamp IDLE
            </span>
            <span>
              <i className="fault" /> lamp FAULT
            </span>
            <span>
              <i className="offline" /> body OFFLINE
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
