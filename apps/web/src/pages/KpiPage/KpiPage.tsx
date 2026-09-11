import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { KpiOverview } from "@imc/shared-types";
import { fetchKpi, type HistoryRangeHours } from "../../api/historyApi";
import { clearSession, getSession } from "../../auth/authStorage";
import "./KpiPage.css";

const RANGES: HistoryRangeHours[] = [1, 6, 24];

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function KpiPage() {
  const navigate = useNavigate();
  const session = getSession();
  const [hours, setHours] = useState<HistoryRangeHours>(24);
  const [kpi, setKpi] = useState<KpiOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchKpi(hours)
      .then((data) => {
        if (!cancelled) setKpi(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setKpi(null);
          setError(err instanceof Error ? err.message : "kpi_failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hours]);

  function onLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="kpi-page">
      <header className="kpi-top">
        <div>
          <div className="kpi-brand">IMC</div>
          <h1>KPI / Availability</h1>
          <p className="kpi-sub">
            Workshop A · RUNNING share from Timescale telemetry
          </p>
        </div>
        <div className="kpi-right">
          <nav className="kpi-nav" aria-label="Primary">
            <Link to="/live">Live panel</Link>
            <Link to="/assets">Assets</Link>
            <Link to="/alarms">Alarms</Link>
            <Link to="/work-orders">Work orders</Link>
            <Link to="/history">History</Link>
            <span className="kpi-nav-current" aria-current="page">
              KPI
            </span>
            <Link to="/twin">Twin</Link>
          </nav>
          {session ? (
            <div className="kpi-user">
              <span>
                {session.user.displayName}
                <em>({session.user.role})</em>
              </span>
              <button type="button" className="kpi-logout" onClick={onLogout}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <section className="kpi-toolbar" aria-label="Range">
        <label className="kpi-filter">
          <span>Window</span>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value) as HistoryRangeHours)}
          >
            {RANGES.map((h) => (
              <option key={h} value={h}>
                Last {h}h
              </option>
            ))}
          </select>
        </label>
        {kpi ? (
          <div className="kpi-meta">
            {new Date(kpi.from).toLocaleString()} →{" "}
            {new Date(kpi.to).toLocaleString()} · {kpi.sampleCount} samples
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="kpi-empty">Loading KPI…</div>
      ) : error ? (
        <div className="kpi-empty" role="alert">
          <p>
            Timescale KPI unavailable: <code>{error}</code>
          </p>
          <p>
            Start Timescale (<code>npm run docker:up</code>), set{" "}
            <code>TIMESCALE_URL</code>, run <code>npm run db:migrate</code>, then
            let the simulator write points.
          </p>
        </div>
      ) : !kpi || kpi.assets.length === 0 ? (
        <div className="kpi-empty">
          No telemetry in this window yet. Keep <code>dev:live:db</code> running.
        </div>
      ) : (
        <>
          <section className="kpi-summary" aria-label="Workshop totals">
            <div className="kpi-stat">
              <span className="kpi-stat-label">Availability</span>
              <strong>{pct(kpi.availability)}</strong>
            </div>
            <div className="kpi-stat">
              <span className="kpi-stat-label">Fault share</span>
              <strong>{pct(kpi.faultRatio)}</strong>
            </div>
            <div className="kpi-stat">
              <span className="kpi-stat-label">Assets</span>
              <strong>{kpi.assetCount}</strong>
            </div>
            <div className="kpi-stat">
              <span className="kpi-stat-label">Samples</span>
              <strong>{kpi.sampleCount.toLocaleString()}</strong>
            </div>
          </section>

          <div className="kpi-table-wrap">
            <table className="kpi-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Availability</th>
                  <th>Fault</th>
                  <th>Avg °C</th>
                  <th>Avg kW</th>
                  <th>Samples</th>
                </tr>
              </thead>
              <tbody>
                {kpi.assets.map((a) => (
                  <tr key={a.assetId}>
                    <td>
                      <code>{a.assetId}</code>
                    </td>
                    <td>
                      <div className="kpi-bar-wrap" title={pct(a.availability)}>
                        <div
                          className="kpi-bar"
                          style={{ width: `${Math.min(100, a.availability * 100)}%` }}
                        />
                        <span>{pct(a.availability)}</span>
                      </div>
                    </td>
                    <td>{pct(a.faultRatio)}</td>
                    <td>
                      {a.avgTemperature != null
                        ? a.avgTemperature.toFixed(1)
                        : "—"}
                    </td>
                    <td>
                      {a.avgPower != null ? a.avgPower.toFixed(2) : "—"}
                    </td>
                    <td>{a.samples.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
