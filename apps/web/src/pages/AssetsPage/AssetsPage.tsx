import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AssetRecord, AssetStatus, AssetType } from "@imc/shared-types";
import {
  createAsset,
  deleteAsset,
  listAssets,
  updateAsset,
} from "../../assets/mockAssets";
import { clearSession, getSession } from "../../auth/authStorage";
import "./AssetsPage.css";

const STATUS_OPTIONS: Array<AssetStatus | "ALL"> = [
  "ALL",
  "RUNNING",
  "IDLE",
  "FAULT",
  "OFFLINE",
];

const TYPE_OPTIONS: AssetType[] = [
  "CNC",
  "ROBOT",
  "CONVEYOR",
  "SENSOR",
  "WAREHOUSE",
  "ENERGY",
];

const TYPE_FILTER_OPTIONS: Array<AssetType | "ALL"> = ["ALL", ...TYPE_OPTIONS];

const EMPTY_FORM = {
  assetId: "",
  name: "",
  type: "CNC" as AssetType,
  zone: "",
  status: "OFFLINE" as AssetStatus,
};

type EditorMode = "create" | "edit" | null;

export function AssetsPage() {
  const navigate = useNavigate();
  const session = getSession();
  const canEdit = session?.user.role === "admin";

  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<AssetType | "ALL">("ALL");
  const [zoneFilter, setZoneFilter] = useState<string>("ALL");

  const [editor, setEditor] = useState<EditorMode>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const rows = await listAssets();
      setAssets(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAssets().then((rows) => {
      if (cancelled) return;
      setAssets(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const zones = useMemo(
    () => Array.from(new Set(assets.map((a) => a.zone))).sort(),
    [assets],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .filter((a) => (statusFilter === "ALL" ? true : a.status === statusFilter))
      .filter((a) => (typeFilter === "ALL" ? true : a.type === typeFilter))
      .filter((a) => (zoneFilter === "ALL" ? true : a.zone === zoneFilter))
      .filter((a) => {
        if (!q) return true;
        return (
          a.assetId.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.zone.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.assetId.localeCompare(b.assetId));
  }, [assets, query, statusFilter, typeFilter, zoneFilter]);

  function onLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  function openCreate() {
    setError(null);
    setForm(EMPTY_FORM);
    setEditor("create");
  }

  function openEdit(a: AssetRecord) {
    setError(null);
    setForm({
      assetId: a.assetId,
      name: a.name,
      type: a.type,
      zone: a.zone,
      status: a.status,
    });
    setEditor("edit");
  }

  function closeEditor() {
    if (saving) return;
    setEditor(null);
    setError(null);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editor === "create") {
        await createAsset({
          assetId: form.assetId.trim(),
          name: form.name.trim(),
          type: form.type,
          zone: form.zone.trim(),
          status: form.status,
        });
      } else if (editor === "edit") {
        await updateAsset(form.assetId, {
          name: form.name.trim(),
          type: form.type,
          zone: form.zone.trim(),
          status: form.status,
        });
      }
      setEditor(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(a: AssetRecord) {
    if (!canEdit) return;
    const ok = window.confirm(
      `Delete ${a.assetId}? Related alarms will also be removed.`,
    );
    if (!ok) return;
    setError(null);
    try {
      await deleteAsset(a.assetId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="assets-page">
      <header className="assets-top">
        <div>
          <div className="assets-brand">IMC</div>
          <h1>Asset Registry</h1>
          <p className="assets-sub">
            Workshop A · master data CRUD (admin · Postgres via imc-api)
          </p>
        </div>
        <div className="assets-right">
          <nav className="assets-nav" aria-label="Primary">
            <Link to="/live">Live panel</Link>
            <span className="assets-nav-current" aria-current="page">
              Assets
            </span>
            <Link to="/alarms">Alarms</Link>
            <Link to="/work-orders">Work orders</Link>
            <Link to="/history">History</Link>
            <Link to="/kpi">KPI</Link>
            <Link to="/twin">Twin</Link>
          </nav>
          {session ? (
            <div className="assets-user">
              <span>
                {session.user.displayName}
                <em>({session.user.role})</em>
              </span>
              <button type="button" className="assets-logout" onClick={onLogout}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <section className="assets-toolbar" aria-label="Filters">
        <input
          className="assets-search"
          type="search"
          placeholder="Search id, name, zone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search assets"
        />
        <label className="assets-filter">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as AssetStatus | "ALL")
            }
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="assets-filter">
          <span>Type</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AssetType | "ALL")}
          >
            {TYPE_FILTER_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="assets-filter">
          <span>Zone</span>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
          >
            <option value="ALL">ALL</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        {canEdit ? (
          <button
            type="button"
            className="assets-btn assets-btn-primary"
            onClick={openCreate}
          >
            Add asset
          </button>
        ) : null}
        <div className="assets-count">
          {loading ? "Loading…" : `${filtered.length} / ${assets.length}`}
        </div>
      </section>

      {error && !editor ? (
        <div className="assets-banner" role="alert">
          {error}
        </div>
      ) : null}

      {!canEdit ? (
        <p className="assets-hint">
          Signed in as {session?.user.role ?? "guest"} — registry edits require{" "}
          <code>admin</code> (e.g. admin / admin123).
        </p>
      ) : null}

      {loading ? (
        <div className="assets-empty">Loading registry…</div>
      ) : filtered.length === 0 ? (
        <div className="assets-empty">No assets match the current filters.</div>
      ) : (
        <div className="assets-table-wrap">
          <table className="assets-table">
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Zone</th>
                <th>Status</th>
                <th>Updated</th>
                {canEdit ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.assetId}>
                  <td>
                    <code>{a.assetId}</code>
                  </td>
                  <td>{a.name}</td>
                  <td>{a.type}</td>
                  <td>{a.zone}</td>
                  <td>
                    <span
                      className={`assets-status assets-status-${a.status.toLowerCase()}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="assets-ts">
                    {new Date(a.updatedAt).toLocaleString()}
                  </td>
                  {canEdit ? (
                    <td className="assets-actions">
                      <button
                        type="button"
                        className="assets-btn"
                        onClick={() => openEdit(a)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="assets-btn assets-btn-danger"
                        onClick={() => onDelete(a)}
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editor ? (
        <div
          className="assets-modal-backdrop"
          role="presentation"
          onClick={closeEditor}
        >
          <form
            className="assets-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assets-modal-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSave}
          >
            <h2 id="assets-modal-title">
              {editor === "create" ? "Add asset" : `Edit ${form.assetId}`}
            </h2>
            <label className="assets-field">
              <span>Asset ID</span>
              <input
                required
                pattern="[A-Za-z0-9_-]{2,64}"
                title="2–64 chars: letters, digits, _ or -"
                value={form.assetId}
                disabled={editor === "edit" || saving}
                onChange={(e) =>
                  setForm((f) => ({ ...f, assetId: e.target.value }))
                }
              />
            </label>
            <label className="assets-field">
              <span>Name</span>
              <input
                required
                maxLength={120}
                value={form.name}
                disabled={saving}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </label>
            <label className="assets-field">
              <span>Type</span>
              <select
                value={form.type}
                disabled={saving}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    type: e.target.value as AssetType,
                  }))
                }
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="assets-field">
              <span>Zone</span>
              <input
                required
                maxLength={80}
                value={form.zone}
                disabled={saving}
                onChange={(e) =>
                  setForm((f) => ({ ...f, zone: e.target.value }))
                }
              />
            </label>
            <label className="assets-field">
              <span>Status</span>
              <select
                value={form.status}
                disabled={saving}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as AssetStatus,
                  }))
                }
              >
                {STATUS_OPTIONS.filter((s) => s !== "ALL").map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <div className="assets-banner" role="alert">
                {error}
              </div>
            ) : null}
            <div className="assets-modal-actions">
              <button
                type="button"
                className="assets-btn"
                onClick={closeEditor}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="assets-btn assets-btn-primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
