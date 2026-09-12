import {
  DEFAULT_THRESHOLDS,
  mergeThresholds,
  type AlarmRecord,
  type AlarmRule,
  type AlarmSeverity,
  type TelemetryPayload,
  type Thresholds,
} from "@imc/shared-types";

/** All alarms for this process (including CLEARED). */
const alarmsById = new Map<string, AlarmRecord>();

/** Open key → alarmId for asset+rule while ACTIVE/ACKED. */
const openByKey = new Map<string, string>();

let globalThresholds: Thresholds = { ...DEFAULT_THRESHOLDS };
const assetOverrides = new Map<string, Partial<Thresholds>>();

export function applyThresholdConfig(
  global: Thresholds,
  overrides: Record<string, Partial<Thresholds>> = {},
) {
  globalThresholds = mergeThresholds(DEFAULT_THRESHOLDS, global);
  assetOverrides.clear();
  for (const [assetId, partial] of Object.entries(overrides)) {
    assetOverrides.set(assetId, partial);
  }
}

export function resolvedThresholds(assetId: string): Thresholds {
  return mergeThresholds(globalThresholds, assetOverrides.get(assetId));
}

export function currentGlobalThresholds(): Thresholds {
  return { ...globalThresholds };
}

function openKey(assetId: string, rule: AlarmRule) {
  return `${assetId}:${rule}`;
}

export function listAlarms(): AlarmRecord[] {
  return [...alarmsById.values()].sort((a, b) => b.raisedAt - a.raisedAt);
}

export function getAlarm(alarmId: string): AlarmRecord | undefined {
  return alarmsById.get(alarmId);
}

export function openAlarmCount(): number {
  return openByKey.size;
}

/** Test helper — not used in production. */
export function resetAlarmState() {
  alarmsById.clear();
  openByKey.clear();
  globalThresholds = { ...DEFAULT_THRESHOLDS };
  assetOverrides.clear();
}

function upsert(alarm: AlarmRecord): AlarmRecord {
  alarmsById.set(alarm.alarmId, alarm);
  const key = openKey(alarm.assetId, alarm.rule);
  if (alarm.state === "CLEARED") {
    if (openByKey.get(key) === alarm.alarmId) openByKey.delete(key);
  } else {
    openByKey.set(key, alarm.alarmId);
  }
  return alarm;
}

/** Restore alarms from Postgres into the in-memory maps. */
export function hydrateAlarms(alarms: AlarmRecord[]) {
  alarmsById.clear();
  openByKey.clear();
  for (const a of alarms) upsert(a);
  console.log(`[realtime] hydrated ${alarms.length} alarms from postgres`);
}

function findOpen(assetId: string, rule: AlarmRule): AlarmRecord | undefined {
  const id = openByKey.get(openKey(assetId, rule));
  return id ? alarmsById.get(id) : undefined;
}

function raise(
  assetId: string,
  rule: AlarmRule,
  value: number,
  threshold: number,
  severity: AlarmSeverity,
  raisedAt: number,
): AlarmRecord {
  const alarm: AlarmRecord = {
    alarmId: `alm_${assetId}_${rule}_${raisedAt}`,
    assetId,
    rule,
    severity,
    state: "ACTIVE",
    value,
    threshold,
    raisedAt,
  };
  return upsert(alarm);
}

/**
 * High-side analog rule (TEMP_HIGH / POWER_HIGH).
 * Returns alarms that should be broadcast (raise / clear), not silent value ticks.
 */
function evaluateHigh(
  assetId: string,
  rule: AlarmRule,
  value: number,
  threshold: number,
  severity: AlarmSeverity,
  raisedAt: number,
): AlarmRecord[] {
  const changed: AlarmRecord[] = [];
  const open = findOpen(assetId, rule);

  if (value > threshold) {
    if (!open) {
      const raised = raise(assetId, rule, value, threshold, severity, raisedAt);
      console.log(
        `[realtime] alarm RAISE ${raised.alarmId} ${value} > ${threshold}`,
      );
      changed.push(raised);
    } else if (open.value !== value || open.threshold !== threshold) {
      upsert({ ...open, value, threshold });
    }
    return changed;
  }

  if (open?.state === "ACKED") {
    const cleared = upsert({
      ...open,
      state: "CLEARED",
      value,
      threshold,
      clearedAt: Date.now(),
    });
    console.log(`[realtime] alarm CLEAR ${cleared.alarmId}`);
    changed.push(cleared);
  } else if (open?.state === "ACTIVE" && open.value !== value) {
    upsert({ ...open, value, threshold });
  }

  return changed;
}

/**
 * Evaluate TEMP_HIGH + POWER_HIGH after each telemetry sample.
 * Also treats the asset as online (caller should run evaluateOffline with age 0).
 */
export function evaluateTelemetry(
  data: TelemetryPayload,
  thresholds: Thresholds = resolvedThresholds(data.assetId),
): AlarmRecord[] {
  const changed: AlarmRecord[] = [];
  const ts = data.ts || Date.now();
  changed.push(
    ...evaluateHigh(
      data.assetId,
      "TEMP_HIGH",
      data.metrics.temperature,
      thresholds.temperatureMaxC,
      "CRITICAL",
      ts,
    ),
  );
  changed.push(
    ...evaluateHigh(
      data.assetId,
      "POWER_HIGH",
      data.metrics.power,
      thresholds.powerMaxKw,
      "WARNING",
      ts,
    ),
  );
  return changed;
}

/**
 * OFFLINE timeout. `secondsSinceSeen` is 0 when a fresh sample just arrived.
 */
export function evaluateOffline(
  assetId: string,
  secondsSinceSeen: number,
  timeoutSec: number = resolvedThresholds(assetId).offlineTimeoutSec,
  now = Date.now(),
): AlarmRecord[] {
  const changed: AlarmRecord[] = [];
  const open = findOpen(assetId, "OFFLINE");
  const timedOut = secondsSinceSeen > timeoutSec;

  if (timedOut) {
    if (!open) {
      const raised = raise(
        assetId,
        "OFFLINE",
        secondsSinceSeen,
        timeoutSec,
        "WARNING",
        now,
      );
      console.log(
        `[realtime] alarm RAISE ${raised.alarmId} silent ${secondsSinceSeen.toFixed(0)}s > ${timeoutSec}s`,
      );
      changed.push(raised);
    } else if (open.value !== secondsSinceSeen) {
      upsert({ ...open, value: secondsSinceSeen, threshold: timeoutSec });
    }
    return changed;
  }

  if (open?.state === "ACKED") {
    const cleared = upsert({
      ...open,
      state: "CLEARED",
      value: secondsSinceSeen,
      threshold: timeoutSec,
      clearedAt: now,
    });
    console.log(`[realtime] alarm CLEAR ${cleared.alarmId}`);
    changed.push(cleared);
  } else if (open?.state === "ACTIVE") {
    upsert({ ...open, value: secondsSinceSeen, threshold: timeoutSec });
  }

  return changed;
}

export type AckLatest = {
  temperature?: number;
  power?: number;
  online?: boolean;
};

function conditionAlreadyClear(alarm: AlarmRecord, latest?: AckLatest): boolean {
  if (alarm.rule === "TEMP_HIGH") {
    return (
      latest?.temperature !== undefined && latest.temperature <= alarm.threshold
    );
  }
  if (alarm.rule === "POWER_HIGH") {
    return latest?.power !== undefined && latest.power <= alarm.threshold;
  }
  if (alarm.rule === "OFFLINE") {
    return latest?.online === true;
  }
  return false;
}

/**
 * Operator ack. If the condition is already gone, move straight to CLEARED.
 */
export function acknowledgeAlarm(
  alarmId: string,
  ackedBy: string,
  latest?: AckLatest,
): AlarmRecord | { error: string } {
  const alarm = alarmsById.get(alarmId);
  if (!alarm) return { error: "not_found" };
  if (alarm.state !== "ACTIVE") return { error: "not_active" };

  const now = Date.now();
  if (conditionAlreadyClear(alarm, latest)) {
    const cleared = upsert({
      ...alarm,
      state: "CLEARED",
      value:
        alarm.rule === "TEMP_HIGH"
          ? (latest?.temperature ?? alarm.value)
          : alarm.rule === "POWER_HIGH"
            ? (latest?.power ?? alarm.value)
            : 0,
      ackedAt: now,
      ackedBy,
      clearedAt: now,
    });
    console.log(`[realtime] alarm ACK+CLEAR ${cleared.alarmId} by ${ackedBy}`);
    return cleared;
  }

  const acked = upsert({
    ...alarm,
    state: "ACKED",
    ackedAt: now,
    ackedBy,
  });
  console.log(`[realtime] alarm ACK ${acked.alarmId} by ${ackedBy}`);
  return acked;
}
