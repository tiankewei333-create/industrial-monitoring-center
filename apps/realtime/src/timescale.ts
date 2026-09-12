/**
 * Batch-insert telemetry into TimescaleDB when TIMESCALE_URL is set.
 */
import pg from "pg";
import type { TelemetryPayload } from "@imc/shared-types";

const TIMESCALE_URL =
  process.env.TIMESCALE_URL?.trim() ||
  "postgres://imc:imc_dev_password@127.0.0.1:5433/imc_ts";
const FLUSH_MS = Math.max(500, Number(process.env.TIMESCALE_FLUSH_MS ?? 2000));
const MAX_QUEUE = Math.max(100, Number(process.env.TIMESCALE_QUEUE_MAX ?? 2000));

type Row = {
  ts: Date;
  assetId: string;
  temperature: number;
  speed: number;
  power: number;
  status: string;
};

let pool: pg.Pool | null = null;
let queue: Row[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let enabled = false;

export function timescaleEnabled(): boolean {
  return enabled;
}

export async function initTimescale(): Promise<boolean> {
  if (!TIMESCALE_URL) {
    console.log("[realtime] TIMESCALE_URL unset → history persist off");
    return false;
  }

  pool = new pg.Pool({ connectionString: TIMESCALE_URL, max: 4 });
  await pool.query("SELECT 1");
  enabled = true;
  timer = setInterval(() => {
    void flushQueue();
  }, FLUSH_MS);
  console.log(
    `[realtime] timescale ok ${TIMESCALE_URL.replace(/:[^:@/]+@/, ":***@")} flush=${FLUSH_MS}ms`,
  );
  return true;
}

export function enqueueTelemetry(data: TelemetryPayload) {
  if (!enabled || !pool) return;
  queue.push({
    ts: new Date(data.ts),
    assetId: data.assetId,
    temperature: data.metrics.temperature,
    speed: data.metrics.speed,
    power: data.metrics.power,
    status: data.status,
  });
  if (queue.length > MAX_QUEUE) {
    queue.splice(0, queue.length - MAX_QUEUE);
  }
}

async function flushQueue() {
  if (!pool || queue.length === 0) return;
  const batch = queue;
  queue = [];

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let i = 1;
  for (const row of batch) {
    placeholders.push(
      `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`,
    );
    values.push(
      row.ts,
      row.assetId,
      row.temperature,
      row.speed,
      row.power,
      row.status,
    );
  }

  try {
    await pool.query(
      `INSERT INTO telemetry (ts, asset_id, temperature, speed, power, status)
       VALUES ${placeholders.join(",")}`,
      values,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[realtime] timescale flush failed (${message}); re-queue ${batch.length}`);
    queue = batch.concat(queue).slice(-MAX_QUEUE);
  }
}

export async function closeTimescale() {
  if (timer) clearInterval(timer);
  timer = null;
  await flushQueue();
  await pool?.end();
  pool = null;
  enabled = false;
}
