import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { WorkOrderRecord, WorkOrderStatus } from "@imc/shared-types";
import {
  listWorkOrders,
  updateWorkOrder,
} from "../../api/workOrdersApi";
import { PrimaryNav } from "../../layout/PrimaryNav";
import { clearSession, getSession } from "../../auth/authStorage";
import "./WorkOrdersPage.css";

const STATUS_OPTIONS: Array<WorkOrderStatus | "ALL" | "OPEN_PIPELINE"> = [
  "OPEN_PIPELINE",
  "ALL",
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
];

export function WorkOrdersPage() {
  const navigate = useNavigate();
  const session = getSession();
  const [params] = useSearchParams();
  const highlight = params.get("id") ?? "";
  const canEdit =
    session?.user.role === "operator" || session?.user.role === "admin";

  const [rows, setRows] = useState<WorkOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    WorkOrderStatus | "ALL" | "OPEN_PIPELINE"
  >("OPEN_PIPELINE");
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listWorkOrders();
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    return rows.filter((w) => {
      if (statusFilter === "ALL") return true;
      if (statusFilter === "OPEN_PIPELINE") {
        return w.status === "OPEN" || w.status === "IN_PROGRESS";
      }
      return w.status === statusFilter;
    });
  }, [rows, statusFilter]);

  function onLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  async function setStatus(id: string, status: WorkOrderStatus) {
    if (!canEdit) return;
    setBusyId(id);
    setError(null);
    try {
      const updated = await updateWorkOrder(id, { status });
      setRows((prev) =>
        prev.map((w) => (w.workOrderId === id ? updated : w)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="wo-page">
      <header className="wo-top">
        <div>
          <div className="wo-brand">IMC</div>
          <h1>Work Orders</h1>
          <p className="wo-sub">
            Workshop A · alarm → maintenance ticket (operator / admin)
          </p>
        </div>
        <div className="wo-right">
          <PrimaryNav ns="wo" current="work-orders" />
          {session ? (
            <div className="wo-user">
              <span>
                {session.user.displayName}
                <em>({session.user.role})</em>
              </span>
              <button type="button" className="wo-logout" onClick={onLogout}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <section className="wo-toolbar" aria-label="Filters">
        <label className="wo-filter">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as WorkOrderStatus | "ALL" | "OPEN_PIPELINE",
              )
            }
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "OPEN_PIPELINE" ? "OPEN + IN_PROGRESS" : s}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="wo-btn" onClick={() => void reload()}>
          Refresh
        </button>
        <div className="wo-count">
          {loading ? "Loading…" : `${filtered.length} / ${rows.length}`}
        </div>
      </section>

      {error ? (
        <div className="wo-banner" role="alert">
          {error}
        </div>
      ) : null}

      {!canEdit ? (
        <p className="wo-hint">
          Read-only as {session?.user.role ?? "guest"}. Create / advance tickets
          with <code>operator</code> or <code>admin</code>.
        </p>
      ) : (
        <p className="wo-hint">
          Create from <Link to="/alarms">Alarms</Link> → Create WO.
        </p>
      )}

      {loading ? (
        <div className="wo-empty">Loading work orders…</div>
      ) : filtered.length === 0 ? (
        <div className="wo-empty">
          No work orders in this filter. Raise an alarm, then Create WO on the
          Alarms page.
        </div>
      ) : (
        <div className="wo-table-wrap">
          <table className="wo-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Priority</th>
                <th>Title</th>
                <th>Asset</th>
                <th>Created</th>
                <th>Assignee</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr
                  key={w.workOrderId}
                  className={
                    highlight === w.workOrderId ? "wo-row-highlight" : undefined
                  }
                >
                  <td>
                    <span
                      className={`wo-status wo-status-${w.status.toLowerCase()}`}
                    >
                      {w.status}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        w.priority === "HIGH" ? "wo-priority-high" : undefined
                      }
                    >
                      {w.priority}
                    </span>
                  </td>
                  <td>
                    <div className="wo-title">{w.title}</div>
                    <code className="wo-id">{w.workOrderId}</code>
                    {w.alarmId ? (
                      <div className="wo-alarm">alarm {w.alarmId}</div>
                    ) : null}
                  </td>
                  <td>
                    <code>{w.assetId}</code>
                  </td>
                  <td className="wo-ts">
                    {new Date(w.createdAt).toLocaleString()}
                    <div className="wo-by">by {w.createdBy}</div>
                  </td>
                  <td>{w.assignedTo ?? "—"}</td>
                  <td className="wo-actions">
                    {canEdit && w.status === "OPEN" ? (
                      <button
                        type="button"
                        className="wo-btn wo-btn-primary"
                        disabled={busyId === w.workOrderId}
                        onClick={() =>
                          void setStatus(w.workOrderId, "IN_PROGRESS")
                        }
                      >
                        Start
                      </button>
                    ) : null}
                    {canEdit &&
                    (w.status === "OPEN" || w.status === "IN_PROGRESS") ? (
                      <button
                        type="button"
                        className="wo-btn"
                        disabled={busyId === w.workOrderId}
                        onClick={() => void setStatus(w.workOrderId, "DONE")}
                      >
                        Done
                      </button>
                    ) : null}
                    {canEdit &&
                    (w.status === "OPEN" || w.status === "IN_PROGRESS") ? (
                      <button
                        type="button"
                        className="wo-btn wo-btn-muted"
                        disabled={busyId === w.workOrderId}
                        onClick={() =>
                          void setStatus(w.workOrderId, "CANCELLED")
                        }
                      >
                        Cancel
                      </button>
                    ) : null}
                    {!canEdit ||
                    w.status === "DONE" ||
                    w.status === "CANCELLED" ? (
                      <span className="wo-muted">—</span>
                    ) : null}
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
