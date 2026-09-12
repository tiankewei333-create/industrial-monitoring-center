import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { HistorySample } from "@imc/shared-types";
import {
  fetchHistory,
  type HistoryRangeHours,
} from "../../api/historyApi";
import { clearSession, getSession } from "../../auth/authStorage";
import { PrimaryNav } from "../../layout/PrimaryNav";
import { downloadCsv } from "../../lib/csv";
import { useRealtimeWs } from "../../realtime/useRealtimeWs";
import { MetricChart, type MetricKey } from "./MetricChart";
import "./HistoryPage.css";

const METRICS: MetricKey[] = ["temperature", "speed", "power"];
const RANGES: HistoryRangeHours[] = [1, 6, 24];

export function HistoryPage() {
  const navigate = useNavigate();
  const session = getSession();
  const [params, setParams] = useSearchParams();
  const { conn, mqttConnected, hello, assets, activeCount, historyByAsset } =
    useRealtimeWs();
  const [metric, setMetric] = useState<MetricKey>("temperature");
  const [hours, setHours] = useState<HistoryRangeHours>(1);
  const [dbSamples, setDbSamples] = useState<HistorySample[] | null>(null);
  const [dbMeta, setDbMeta] = useState<string | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [loadingDb, setLoadingDb] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const assetIds = useMemo(() => {
    const ids = new Set([
      ...Object.keys(assets),
      ...Object.keys(historyByAsset),
    ]);
    return [...ids].sort();
  }, [assets, historyByAsset]);

  const selected =
    params.get("asset") && assetIds.includes(params.get("asset")!)
      ? params.get("asset")!
      : (assetIds[0] ?? "");

  const liveSamples = selected ? (historyByAsset[selected] ?? []) : [];
  const preferDb = hours >= 6;

  useEffect(() => {
    if (!selected || !preferDb) {
      setDbSamples(null);
      setDbMeta(null);
      setDbError(null);
      return;
    }
    let cancelled = false;
    setLoadingDb(true);
    setDbError(null);
    fetchHistory(selected, hours)
      .then((res) => {
        if (cancelled) return;
        setDbSamples(res.samples);
        setDbMeta(`${res.bucket} · ${res.source} · ${res.samples.length} pts`);
      })
      .catch((err) => {
        if (cancelled) return;
        setDbSamples(null);
        setDbMeta(null);
        setDbError(err instanceof Error ? err.message : "history_failed");
      })
      .finally(() => {
        if (!cancelled) setLoadingDb(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, hours, preferDb]);

  // Optional: also try 1h from DB when live is empty
  useEffect(() => {
    if (!selected || preferDb || liveSamples.length >= 2) return;
    let cancelled = false;
    fetchHistory(selected, 1)
      .then((res) => {
        if (cancelled || res.samples.length === 0) return;
        setDbSamples(res.samples);
        setDbMeta(`${res.bucket} · ${res.source}`);
      })
      .catch(() => {
        /* keep live */
      });
    return () => {
      cancelled = true;
    };
  }, [selected, preferDb, liveSamples.length]);

  const samples =
    preferDb && dbSamples && dbSamples.length > 0
      ? dbSamples
      : !preferDb && dbSamples && liveSamples.length < 2
        ? dbSamples
        : liveSamples;

  useEffect(() => {
    setCursor(samples.length ? samples.length - 1 : null);
    setPlaying(false);
  }, [selected, hours]);

  useEffect(() => {
    if (!playing || samples.length < 2) return;
    const id = window.setInterval(() => {
      setCursor((c) => {
        const i = c ?? 0;
        if (i >= samples.length - 1) {
          setPlaying(false);
          return samples.length - 1;
        }
        return i + 1;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [playing, samples.length]);

  const playSample =
    cursor != null && samples[cursor] ? samples[cursor] : samples[samples.length - 1];

  const sourceLabel = preferDb
    ? dbError
      ? `Timescale error → live buffer`
      : loadingDb
        ? "Loading Timescale…"
        : (dbMeta ?? "Timescale")
    : `Live ring ~${Math.round(liveSamples.length / 60)} min`;

  function onLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="history-page">
      <header className="history-top">
        <div>
          <div className="history-brand">IMC</div>
          <h1>History</h1>
          <p className="history-sub">
            Live ring + Timescale 1h / 6h / 24h ({sourceLabel})
          </p>
        </div>
        <div className="history-right">
          <PrimaryNav ns="history" current="history" activeCount={activeCount} />
          <div className="history-badges">
            <span className={`history-badge ${conn === "open" ? "ok" : "bad"}`}>
              WS {conn}
            </span>
            <span className={`history-badge ${mqttConnected ? "ok" : "bad"}`}>
              MQTT {mqttConnected ? "live" : "down"}
            </span>
          </div>
          {session ? (
            <div className="history-user">
              <span>
                {session.user.displayName}
                <em>({session.user.role})</em>
              </span>
              <button type="button" className="history-logout" onClick={onLogout}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {hello ? <p className="history-meta">{hello}</p> : null}
      {dbError && preferDb ? (
        <p className="history-meta history-warn" role="status">
          Timescale: {dbError} — showing live buffer if available. Start Timescale
          and set TIMESCALE_URL.
        </p>
      ) : null}

      {assetIds.length === 0 ? (
        <div className="history-empty">
          Waiting for telemetry… start <code>npm run dev:live:db</code>
        </div>
      ) : (
        <>
          <section className="history-toolbar" aria-label="Series">
            <label className="history-filter">
              <span>Asset</span>
              <select
                value={selected}
                onChange={(e) => setParams({ asset: e.target.value })}
              >
                {assetIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <label className="history-filter">
              <span>Range</span>
              <select
                value={hours}
                onChange={(e) =>
                  setHours(Number(e.target.value) as HistoryRangeHours)
                }
              >
                {RANGES.map((h) => (
                  <option key={h} value={h}>
                    {h}h
                  </option>
                ))}
              </select>
            </label>
            <div className="history-metrics" role="tablist" aria-label="Metric">
              {METRICS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={metric === m}
                  className={metric === m ? "on" : undefined}
                  onClick={() => setMetric(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="history-count">
              {samples.length} pts
              {playSample
                ? ` · ${new Date(playSample.ts).toLocaleTimeString()} T=${playSample.temperature.toFixed(1)}°C`
                : ""}
            </div>
            <button
              type="button"
              className="history-csv"
              disabled={samples.length === 0}
              onClick={() =>
                downloadCsv(`history-${selected}-${hours}h.csv`, [
                  ["ts", "temperature", "speed", "power", "status"],
                  ...samples.map((s) => [
                    new Date(s.ts).toISOString(),
                    s.temperature,
                    s.speed,
                    s.power,
                    s.status,
                  ]),
                ])
              }
            >
              CSV
            </button>
          </section>

          {samples.length >= 2 ? (
            <section className="history-play" aria-label="Playback">
              <button
                type="button"
                onClick={() => {
                  if (cursor === samples.length - 1) setCursor(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(0, samples.length - 1)}
                value={cursor ?? 0}
                onChange={(e) => {
                  setPlaying(false);
                  setCursor(Number(e.target.value));
                }}
              />
              <span>
                {cursor != null ? cursor + 1 : 0}/{samples.length}
              </span>
            </section>
          ) : null}

          <div className="history-chart-wrap">
            {samples.length < 2 ? (
              <div className="history-empty inner">
                {loadingDb
                  ? "Loading…"
                  : `Collecting samples for ${selected}…`}
              </div>
            ) : (
              <MetricChart samples={samples} metric={metric} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
