import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { AssetRecord, AuditRecord, Thresholds } from "@imc/shared-types";
import { DEFAULT_THRESHOLDS } from "@imc/shared-types";
import {
  fetchAudit,
  fetchThresholds,
  saveAssetThresholds,
  saveGlobalThresholds,
} from "../../api/opsApi";
import { listAssets } from "../../assets/mockAssets";
import { clearSession, getSession } from "../../auth/authStorage";
import { PrimaryNav } from "../../layout/PrimaryNav";
import "./SettingsPage.css";

export function SettingsPage() {
  const navigate = useNavigate();
  const session = getSession();
  const canEdit = session?.user.role === "admin";

  const [global, setGlobal] = useState<Thresholds>({ ...DEFAULT_THRESHOLDS });
  const [overrides, setOverrides] = useState<
    Record<string, Partial<Thresholds>>
  >({});
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [meta, setMeta] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setError("");
    try {
      const [th, rows] = await Promise.all([
        fetchThresholds(),
        listAssets(),
      ]);
      setGlobal(th.global);
      setOverrides(th.overrides);
      setAssets(rows);
      setMeta(
        th.updatedBy
          ? `Last saved by ${th.updatedBy}${th.updatedAt ? ` · ${new Date(th.updatedAt).toLocaleString()}` : ""}`
          : "",
      );
      try {
        setAudit(await fetchAudit(80));
      } catch {
        setAudit([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function onLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  async function onSaveGlobal(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError("");
    try {
      const next = await saveGlobalThresholds(global);
      setGlobal(next);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveOverride(assetId: string) {
    if (!canEdit) return;
    setSaving(true);
    setError("");
    const o = overrides[assetId] ?? {};
    try {
      await saveAssetThresholds(assetId, {
        temperatureMaxC: o.temperatureMaxC ?? null,
        powerMaxKw: o.powerMaxKw ?? null,
        offlineTimeoutSec: o.offlineTimeoutSec ?? null,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function setOverride(
    assetId: string,
    field: keyof Thresholds,
    raw: string,
  ) {
    setOverrides((prev) => {
      const next = { ...(prev[assetId] ?? {}) };
      if (raw.trim() === "") {
        delete next[field];
      } else {
        const n = Number(raw);
        if (Number.isFinite(n)) next[field] = n;
      }
      return { ...prev, [assetId]: next };
    });
  }

  return (
    <div className="settings-page">
      <header className="settings-top">
        <div>
          <div className="settings-brand">IMC</div>
          <h1>Settings & audit</h1>
          <p className="settings-sub">
            Configurable thresholds (admin) · operator audit trail
          </p>
        </div>
        <div className="settings-right">
          <PrimaryNav ns="settings" current="settings" />
          {session ? (
            <div className="settings-user">
              <span>
                {session.user.displayName}
                <em>({session.user.role})</em>
              </span>
              <button type="button" className="settings-logout" onClick={onLogout}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="settings-error" role="alert">
          {error}
        </p>
      ) : null}
      {meta ? <p className="settings-meta">{meta}</p> : null}

      <section className="settings-card">
        <h2>Global thresholds</h2>
        <p className="settings-hint">
          Realtime picks these up within a few seconds. Empty per-asset cells
          inherit global. Offline timeout is seconds without telemetry.
        </p>
        <form className="settings-form" onSubmit={(e) => void onSaveGlobal(e)}>
          <label>
            <span>Temperature max (°C)</span>
            <input
              type="number"
              step="0.1"
              min={1}
              max={300}
              disabled={!canEdit}
              value={global.temperatureMaxC}
              onChange={(e) =>
                setGlobal((g) => ({
                  ...g,
                  temperatureMaxC: Number(e.target.value),
                }))
              }
            />
          </label>
          <label>
            <span>Power max (kW)</span>
            <input
              type="number"
              step="0.1"
              min={0.1}
              disabled={!canEdit}
              value={global.powerMaxKw}
              onChange={(e) =>
                setGlobal((g) => ({ ...g, powerMaxKw: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            <span>Offline timeout (s)</span>
            <input
              type="number"
              min={5}
              max={3600}
              disabled={!canEdit}
              value={global.offlineTimeoutSec}
              onChange={(e) =>
                setGlobal((g) => ({
                  ...g,
                  offlineTimeoutSec: Number(e.target.value),
                }))
              }
            />
          </label>
          <button type="submit" disabled={!canEdit || saving}>
            {saving ? "Saving…" : "Save global"}
          </button>
        </form>
        {!canEdit ? (
          <p className="settings-hint">Observer / operator can view only.</p>
        ) : null}
      </section>

      <section className="settings-card">
        <h2>Per-asset overrides</h2>
        <div className="settings-table-wrap">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Temp °C</th>
                <th>Power kW</th>
                <th>Offline s</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const o = overrides[a.assetId] ?? {};
                return (
                  <tr key={a.assetId}>
                    <td>
                      <code>{a.assetId}</code>
                    </td>
                    <td>
                      <input
                        type="number"
                        placeholder={`${global.temperatureMaxC}`}
                        disabled={!canEdit}
                        value={o.temperatureMaxC ?? ""}
                        onChange={(e) =>
                          setOverride(a.assetId, "temperatureMaxC", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        placeholder={`${global.powerMaxKw}`}
                        disabled={!canEdit}
                        value={o.powerMaxKw ?? ""}
                        onChange={(e) =>
                          setOverride(a.assetId, "powerMaxKw", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        placeholder={`${global.offlineTimeoutSec}`}
                        disabled={!canEdit}
                        value={o.offlineTimeoutSec ?? ""}
                        onChange={(e) =>
                          setOverride(
                            a.assetId,
                            "offlineTimeoutSec",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={!canEdit || saving}
                        onClick={() => void onSaveOverride(a.assetId)}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="settings-card">
        <h2>Audit log</h2>
        {audit.length === 0 ? (
          <p className="settings-hint">No audit events yet.</p>
        ) : (
          <div className="settings-table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((ev) => (
                  <tr key={ev.id}>
                    <td className="settings-ts">
                      {new Date(ev.at).toLocaleString()}
                    </td>
                    <td>
                      {ev.actor}
                      {ev.role ? <em> ({ev.role})</em> : null}
                    </td>
                    <td>
                      <code>{ev.action}</code>
                    </td>
                    <td>
                      {ev.entityType}
                      {ev.entityId ? ` · ${ev.entityId}` : ""}
                    </td>
                    <td className="settings-detail">
                      {ev.detail ? JSON.stringify(ev.detail) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
