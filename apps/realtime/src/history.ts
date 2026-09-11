import {
  HISTORY_DEFAULTS,
  type HistorySample,
  type HistorySeries,
  type TelemetryPayload,
} from "@imc/shared-types";

const MAX_POINTS = Math.max(
  30,
  Number(process.env.HISTORY_MAX_POINTS ?? HISTORY_DEFAULTS.maxPoints),
);

const buffers = new Map<string, HistorySample[]>();

export function historyMaxPoints(): number {
  return MAX_POINTS;
}

export function toHistorySample(data: TelemetryPayload): HistorySample {
  return {
    ts: data.ts,
    temperature: data.metrics.temperature,
    speed: data.metrics.speed,
    power: data.metrics.power,
    status: data.status,
  };
}

export function appendHistory(data: TelemetryPayload) {
  const sample = toHistorySample(data);
  let list = buffers.get(data.assetId);
  if (!list) {
    list = [];
    buffers.set(data.assetId, list);
  }

  const last = list[list.length - 1];
  if (last && last.ts === sample.ts) {
    list[list.length - 1] = sample;
  } else {
    list.push(sample);
  }

  if (list.length > MAX_POINTS) {
    list.splice(0, list.length - MAX_POINTS);
  }
}

export function getHistory(assetId: string): HistorySample[] {
  return buffers.get(assetId) ?? [];
}

export function listHistorySeries(): HistorySeries[] {
  return [...buffers.entries()].map(([assetId, samples]) => ({
    assetId,
    samples,
  }));
}

export function historyPointCount(): number {
  let n = 0;
  for (const samples of buffers.values()) n += samples.length;
  return n;
}
