import {
  DEFAULT_THRESHOLDS,
  type AlarmRecord,
  type AlarmRule,
  type TelemetryPayload,
} from "@imc/shared-types";

const TEMP_RULE: AlarmRule = "TEMP_HIGH";
const TEMP_MAX = DEFAULT_THRESHOLDS.temperatureMaxC;

/** All alarms for this process (including CLEARED). */
const alarmsById = new Map<string, AlarmRecord>();

/** Open key → alarmId for asset+rule while ACTIVE/ACKED. */
const openByKey = new Map<string, string>();

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

function raiseTempHigh(data: TelemetryPayload): AlarmRecord {
  const raisedAt = data.ts || Date.now();
  const alarm: AlarmRecord = {
    alarmId: `alm_${data.assetId}_${TEMP_RULE}_${raisedAt}`,
    assetId: data.assetId,
    rule: TEMP_RULE,
    severity: "CRITICAL",
    state: "ACTIVE",
    value: data.metrics.temperature,
    threshold: TEMP_MAX,
    raisedAt,
  };
  return upsert(alarm);
}

/**
 * Evaluate TEMP_HIGH after each telemetry sample.
 * Returns alarms that changed (raise / value update / clear).
 */
export function evaluateTelemetry(data: TelemetryPayload): AlarmRecord[] {
  const changed: AlarmRecord[] = [];
  const temp = data.metrics.temperature;
  const open = findOpen(data.assetId, TEMP_RULE);

  if (temp > TEMP_MAX) {
    if (!open) {
      const raised = raiseTempHigh(data);
      console.log(
        `[realtime] alarm RAISE ${raised.alarmId} T=${raised.value}°C > ${TEMP_MAX}`,
      );
      changed.push(raised);
    } else if (open.value !== temp) {
      // Keep open (no re-raise); refresh peak/current value silently.
      upsert({ ...open, value: temp });
    }
    return changed;
  }

  // Temperature back at/below threshold → clear only after ACKED
  if (open?.state === "ACKED") {
    const cleared = upsert({
      ...open,
      state: "CLEARED",
      value: temp,
      clearedAt: Date.now(),
    });
    console.log(`[realtime] alarm CLEAR ${cleared.alarmId} T=${temp}°C`);
    changed.push(cleared);
  } else if (open?.state === "ACTIVE" && open.value !== temp) {
    upsert({ ...open, value: temp });
  }

  return changed;
}

/**
 * Operator ack. If condition already cleared, move straight to CLEARED.
 */
export function acknowledgeAlarm(
  alarmId: string,
  ackedBy: string,
  latestTemp?: number,
): AlarmRecord | { error: string } {
  const alarm = alarmsById.get(alarmId);
  if (!alarm) return { error: "not_found" };
  if (alarm.state !== "ACTIVE") return { error: "not_active" };

  const now = Date.now();
  const below =
    latestTemp !== undefined
      ? latestTemp <= alarm.threshold
      : false;

  if (below) {
    const cleared = upsert({
      ...alarm,
      state: "CLEARED",
      value: latestTemp ?? alarm.value,
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
