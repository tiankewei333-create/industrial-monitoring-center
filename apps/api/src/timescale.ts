/**
 * Optional TimescaleDB connection for telemetry history / KPI.
 * Unset TIMESCALE_URL → history stays memory-only in realtime.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TS_SQL_DIR = path.resolve(__dirname, "../../../deploy/sql/ts");

export const TIMESCALE_URL =
  process.env.TIMESCALE_URL?.trim() ||
  "postgres://imc:imc_dev_password@127.0.0.1:5433/imc_ts";

let pool: pg.Pool | null = null;

export function timescaleEnabled(): boolean {
  return Boolean(TIMESCALE_URL);
}

export function getTimescalePool(): pg.Pool | null {
  if (!TIMESCALE_URL) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: TIMESCALE_URL, max: 8 });
  }
  return pool;
}

export async function pingTimescale(): Promise<boolean> {
  const p = getTimescalePool();
  if (!p) return false;
  const r = await p.query("SELECT 1 AS ok");
  return r.rows[0]?.ok === 1;
}

/** Apply deploy/sql/ts/*.sql (idempotent). */
export async function migrateTimescale(
  connectionString = TIMESCALE_URL,
): Promise<boolean> {
  if (!connectionString) {
    console.log("[db] TIMESCALE_URL unset → skip timeseries migrate");
    return false;
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log(
    `[db] timescale ${connectionString.replace(/:[^:@/]+@/, ":***@")}`,
  );

  if (!fs.existsSync(TS_SQL_DIR)) {
    console.warn(`[db] missing ${TS_SQL_DIR}`);
    await client.end();
    return false;
  }

  const files = fs
    .readdirSync(TS_SQL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(TS_SQL_DIR, file), "utf8");
    console.log(`[db] apply ts/${file}`);
    await client.query(sql);
  }

  await client.end();
  console.log("[db] timescale migrate ok");
  return true;
}
