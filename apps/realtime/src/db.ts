import pg from "pg";
import {
  DEFAULT_THRESHOLDS,
  type AlarmRecord,
  type AssetStatus,
  type TelemetryPayload,
  type Thresholds,
} from "@imc/shared-types";

const DATABASE_URL =
  process.env.DATABASE_URL?.trim() ||
  "postgres://imc:imc_dev_password@127.0.0.1:5432/imc";

let pool: pg.Pool | null = null;

export function dbEnabled() {
  return Boolean(DATABASE_URL);
}

export async function initDb() {
  if (!DATABASE_URL) {
    console.log("[realtime] DATABASE_URL unset → alarms/assets stay in-memory only");
    return false;
  }
  pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });
  await pool.query("SELECT 1");
  console.log(
    `[realtime] postgres ok ${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}`,
  );
  return true;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

function toTs(ms: number) {
  return new Date(ms).toISOString();
}

export async function upsertAlarm(alarm: AlarmRecord) {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO alarms (
         alarm_id, asset_id, rule, severity, state, value, threshold,
         raised_at, acked_at, cleared_at, acked_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (alarm_id) DO UPDATE SET
         state = EXCLUDED.state,
         value = EXCLUDED.value,
         threshold = EXCLUDED.threshold,
         acked_at = EXCLUDED.acked_at,
         cleared_at = EXCLUDED.cleared_at,
         acked_by = EXCLUDED.acked_by`,
      [
        alarm.alarmId,
        alarm.assetId,
        alarm.rule,
        alarm.severity,
        alarm.state,
        alarm.value,
        alarm.threshold,
        toTs(alarm.raisedAt),
        alarm.ackedAt ? toTs(alarm.ackedAt) : null,
        alarm.clearedAt ? toTs(alarm.clearedAt) : null,
        alarm.ackedBy ?? null,
      ],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[realtime] upsertAlarm failed: ${message}`);
  }
}

export async function touchAssetStatus(data: TelemetryPayload) {
  if (!pool) return;
  try {
    await pool.query(
      `UPDATE assets
       SET status = $2, updated_at = to_timestamp($3 / 1000.0)
       WHERE asset_id = $1`,
      [data.assetId, data.status, data.ts || Date.now()],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[realtime] touchAssetStatus failed: ${message}`);
  }
}

type AlarmRow = {
  alarm_id: string;
  asset_id: string;
  rule: string;
  severity: string;
  state: string;
  value: number;
  threshold: number;
  raised_at: Date;
  acked_at: Date | null;
  cleared_at: Date | null;
  acked_by: string | null;
};

export async function loadAlarmsFromDb(): Promise<AlarmRecord[]> {
  if (!pool) return [];
  const r = await pool.query<AlarmRow>(
    `SELECT alarm_id, asset_id, rule, severity, state, value, threshold,
            raised_at, acked_at, cleared_at, acked_by
     FROM alarms
     ORDER BY raised_at DESC
     LIMIT 500`,
  );
  return r.rows.map((row) => ({
    alarmId: row.alarm_id,
    assetId: row.asset_id,
    rule: row.rule as AlarmRecord["rule"],
    severity: row.severity as AlarmRecord["severity"],
    state: row.state as AlarmRecord["state"],
    value: Number(row.value),
    threshold: Number(row.threshold),
    raisedAt: row.raised_at.getTime(),
    ackedAt: row.acked_at ? row.acked_at.getTime() : undefined,
    clearedAt: row.cleared_at ? row.cleared_at.getTime() : undefined,
    ackedBy: row.acked_by ?? undefined,
  }));
}

export async function loadThresholdConfig(): Promise<{
  global: Thresholds;
  overrides: Record<string, Partial<Thresholds>>;
} | null> {
  if (!pool) return null;
  const globalRow = await pool.query<{ value: Thresholds }>(
    `SELECT value FROM app_settings WHERE key = 'thresholds'`,
  );
  const raw = globalRow.rows[0]?.value;
  const global: Thresholds = {
    temperatureMaxC: Number(raw?.temperatureMaxC) || DEFAULT_THRESHOLDS.temperatureMaxC,
    powerMaxKw: Number(raw?.powerMaxKw) || DEFAULT_THRESHOLDS.powerMaxKw,
    offlineTimeoutSec:
      Number(raw?.offlineTimeoutSec) || DEFAULT_THRESHOLDS.offlineTimeoutSec,
  };

  const assets = await pool.query<{
    asset_id: string;
    temperature_max_c: number | null;
    power_max_kw: number | null;
    offline_timeout_sec: number | null;
  }>(
    `SELECT asset_id, temperature_max_c, power_max_kw, offline_timeout_sec
     FROM assets`,
  );

  const overrides: Record<string, Partial<Thresholds>> = {};
  for (const row of assets.rows) {
    const partial: Partial<Thresholds> = {};
    if (row.temperature_max_c != null) {
      partial.temperatureMaxC = Number(row.temperature_max_c);
    }
    if (row.power_max_kw != null) {
      partial.powerMaxKw = Number(row.power_max_kw);
    }
    if (row.offline_timeout_sec != null) {
      partial.offlineTimeoutSec = Number(row.offline_timeout_sec);
    }
    if (Object.keys(partial).length > 0) {
      overrides[row.asset_id] = partial;
    }
  }
  return { global, overrides };
}

export async function writeAudit(entry: {
  actor: string;
  role?: string;
  action: string;
  entityType: string;
  entityId?: string;
  detail?: Record<string, unknown>;
}) {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO audit_log (actor, role, action, entity_type, entity_id, detail)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        entry.actor,
        entry.role ?? null,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        JSON.stringify(entry.detail ?? {}),
      ],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[realtime] writeAudit failed: ${message}`);
  }
}

export type { AssetStatus };
