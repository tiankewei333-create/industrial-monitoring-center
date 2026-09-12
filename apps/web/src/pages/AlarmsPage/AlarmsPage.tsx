import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatAlarmValue, type AlarmRecord, type AlarmState } from "@imc/shared-types";
import { createWorkOrder } from "../../api/workOrdersApi";
import { clearSession, getSession } from "../../auth/authStorage";
import { PrimaryNav } from "../../layout/PrimaryNav";
import { downloadCsv } from "../../lib/csv";
import { useRealtimeWs } from "../../realtime/useRealtimeWs";
import "./AlarmsPage.css";

const STATE_OPTIONS: Array<AlarmState | "ALL" | "OPEN"> = [
  "ALL",
  "OPEN",
  "ACTIVE",
  "ACKED",
  "CLEARED",
];

export function AlarmsPage() {
  const navigate = useNavigate();
  const session = getSession();
  const {
    conn,
    mqttConnected,
    hello,
    alarms,
    activeCount,
    ackAlarm,
    ackError: wsAckError,
  } = useRealtimeWs();
  const [stateFilter, setStateFilter] = useState<
    AlarmState | "ALL" | "OPEN"
  >("OPEN");
  const [ackError, setAckError] = useState("");
  const [woBusy, setWoBusy] = useState<string | null>(null);
  const [woMsg, setWoMsg] = useState("");

  const canAck =
    session?.user.role === "operator" || session?.user.role === "admin";
  const canCreateWo = canAck;

  const filtered = useMemo(() => {
    return alarms.filter((a) => {
      if (stateFilter === "ALL") return true;
      if (stateFilter === "OPEN") return a.state === "ACTIVE" || a.state === "ACKED";
      return a.state === stateFilter;
    });
  }, [alarms, stateFilter]);

  function onLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  function onAck(alarmId: string) {
    setAckError("");
    if (!canAck || !session) {
      setAckError("Observer cannot acknowledge alarms.");
      return;
    }
    const ok = ackAlarm(alarmId);
    if (!ok) setAckError("WebSocket not connected — cannot ack.");
  }

  async function onCreateWo(a: AlarmRecord) {
    if (!canCreateWo || !session) {
      setWoMsg("Operator or admin required to create work orders.");
      return;
    }
    setWoBusy(a.alarmId);
    setWoMsg("");
    try {
      const wo = await createWorkOrder({
        alarmId: a.alarmId,
        assetId: a.assetId,
        priority: a.severity === "CRITICAL" ? "HIGH" : "NORMAL",
        assignedTo: session.user.username,
      });
      setWoMsg(`Created ${wo.workOrderId}`);
      navigate(`/work-orders?id=${encodeURIComponent(wo.workOrderId)}`);
    } catch (err) {
      setWoMsg(err instanceof Error ? err.message : "Create WO failed");
    } finally {
      setWoBusy(null);
    }
  }

  return (
    <div className="alarms-page">
      <header className="alarms-top">
        <div>
          <div className="alarms-brand">IMC</div>
          <h1>Alarm Center</h1>
          <p className="alarms-sub">
            Workshop A · TEMP_HIGH / POWER_HIGH / OFFLINE → work orders
          </p>
        </div>
        <div className="alarms-right">
          <PrimaryNav ns="alarms" current="alarms" activeCount={activeCount} />
          <div className="alarms-badges">
            <span className={`alarms-badge ${conn === "open" ? "ok" : "bad"}`}>
              WS {conn}
            </span>
            <span className={`alarms-badge ${mqttConnected ? "ok" : "bad"}`}>
              MQTT {mqttConnected ? "live" : "down"}
            </span>
          </div>
          {session ? (
            <div className="alarms-user">
              <span>
                {session.user.displayName}
                <em>({session.user.role})</em>
              </span>
              <button type="button" className="alarms-logout" onClick={onLogout}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {hello ? <p className="alarms-meta">{hello}</p> : null}
      {(ackError || wsAckError) ? (
        <p className="alarms-error" role="alert">
          {ackError ||
            (wsAckError === "forbidden"
              ? "Observer cannot acknowledge alarms."
              : wsAckError === "unauthorized"
                ? "WebSocket auth required — sign in again."
                : wsAckError)}
        </p>
      ) : null}
      {woMsg ? (
        <p className="alarms-meta" role="status">
          {woMsg}
        </p>
      ) : null}

      <section className="alarms-toolbar" aria-label="Filters">
        <label className="alarms-filter">
          <span>State</span>
          <select
            value={stateFilter}
            onChange={(e) =>
              setStateFilter(e.target.value as AlarmState | "ALL" | "OPEN")
            }
          >
            {STATE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="alarms-count">
          {filtered.length} shown · {activeCount} ACTIVE
        </div>
        <button
          type="button"
          className="alarms-ack"
          disabled={filtered.length === 0}
          onClick={() =>
            downloadCsv("alarms.csv", [
              ["alarmId", "assetId", "rule", "state", "value", "threshold", "raisedAt", "ackedBy"],
              ...filtered.map((a) => [
                a.alarmId,
                a.assetId,
                a.rule,
                a.state,
                a.value,
                a.threshold,
                new Date(a.raisedAt).toISOString(),
                a.ackedBy ?? "",
              ]),
            ])
          }
        >
          CSV
        </button>
      </section>

      {filtered.length === 0 ? (
        <div className="alarms-empty">
          No alarms in this filter. Trigger over-temp with{" "}
          <code>npm run dev:simulator:spike</code>, over-power with{" "}
          <code>npm run dev:simulator:power</code>, or stop the simulator for
          OFFLINE.
        </div>
      ) : (
        <div className="alarms-table-wrap">
          <table className="alarms-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Asset</th>
                <th>Rule</th>
                <th>Value</th>
                <th>Threshold</th>
                <th>Raised</th>
                <th>Ack</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.alarmId}
                  className={
                    a.state === "ACTIVE" ? "alarms-row-active" : undefined
                  }
                >
                  <td>
                    <span
                      className={`alarms-state alarms-state-${a.state.toLowerCase()}`}
                    >
                      {a.state}
                    </span>
                  </td>
                  <td>
                    <code>{a.assetId}</code>
                  </td>
                  <td>{a.rule}</td>
                  <td className="alarms-num">{formatAlarmValue(a.rule, a.value)}</td>
                  <td className="alarms-num">
                    {formatAlarmValue(a.rule, a.threshold)}
                  </td>
                  <td className="alarms-ts">
                    {new Date(a.raisedAt).toLocaleString()}
                  </td>
                  <td className="alarms-ts">
                    {a.ackedBy
                      ? `${a.ackedBy} · ${a.ackedAt ? new Date(a.ackedAt).toLocaleTimeString() : ""}`
                      : "—"}
                  </td>
                  <td className="alarms-actions">
                    {a.state === "ACTIVE" ? (
                      <button
                        type="button"
                        className="alarms-ack"
                        disabled={!canAck || conn !== "open"}
                        title={
                          canAck
                            ? "Acknowledge alarm"
                            : "Observer role is read-only"
                        }
                        onClick={() => onAck(a.alarmId)}
                      >
                        Ack
                      </button>
                    ) : null}
                    {a.state !== "CLEARED" ? (
                      <button
                        type="button"
                        className="alarms-ack alarms-wo"
                        disabled={!canCreateWo || woBusy === a.alarmId}
                        title="Create maintenance work order"
                        onClick={() => void onCreateWo(a)}
                      >
                        {woBusy === a.alarmId ? "…" : "Create WO"}
                      </button>
                    ) : (
                      <span className="alarms-action-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
