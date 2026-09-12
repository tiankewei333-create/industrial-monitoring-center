/**
 * Dump Postgres + Timescale via docker exec.
 *   npm run db:backup
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "backups");
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const pgFile = path.join(outDir, `imc-postgres-${stamp}.sql`);
const tsFile = path.join(outDir, `imc-timescale-${stamp}.sql`);

function dump(container, db, dest) {
  const sql = execFileSync(
    "docker",
    ["exec", container, "pg_dump", "-U", "imc", "--no-owner", "--no-acl", db],
    { encoding: "utf8" },
  );
  fs.writeFileSync(dest, sql);
  console.log(`[backup] wrote ${path.relative(root, dest)} (${sql.length} bytes)`);
}

dump("imc-postgres", process.env.POSTGRES_DB || "imc", pgFile);
try {
  dump("imc-timescale", "imc_ts", tsFile);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[backup] timescale skipped: ${message}`);
}

console.log("[backup] restore example:");
console.log(`  docker exec -i imc-postgres psql -U imc -d imc < ${path.relative(root, pgFile)}`);
