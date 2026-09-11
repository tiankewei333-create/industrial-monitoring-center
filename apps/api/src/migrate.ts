/**
 * Apply deploy/sql/*.sql and seed users/assets.
 *   npm run db:migrate -w @imc/api
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import pg from "pg";
import { migrateTimescale } from "./timescale.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.resolve(__dirname, "../../../deploy/sql");

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://imc:imc_dev_password@127.0.0.1:5432/imc";

const USERS = [
  {
    username: "observer",
    password: "observer123",
    role: "observer",
    displayName: "Observer",
  },
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    displayName: "Admin",
  },
  {
    username: "operator",
    password: "operator123",
    role: "operator",
    displayName: "Operator",
  },
] as const;

const ASSETS = [
  ["Machine001", "CNC Lathe A1", "CNC", "Line-A", "OFFLINE"],
  ["Machine002", "CNC Mill A2", "CNC", "Line-A", "OFFLINE"],
  ["Robot001", "Six-Axis Arm B1", "ROBOT", "Line-B", "OFFLINE"],
  ["Robot002", "Pick-Place Arm B2", "ROBOT", "Line-B", "OFFLINE"],
  ["Conveyor001", "Main Belt C1", "CONVEYOR", "Transfer", "OFFLINE"],
  ["Sensor001", "Temp Node T1", "SENSOR", "Line-A", "OFFLINE"],
  ["Warehouse001", "Buffer Rack W1", "WAREHOUSE", "Storage", "OFFLINE"],
  ["Energy001", "Workshop PDU E1", "ENERGY", "Utility", "OFFLINE"],
] as const;

export async function migrateAndSeed(connectionString = DATABASE_URL) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log(
    `[db] connected ${connectionString.replace(/:[^:@/]+@/, ":***@")}`,
  );

  const files = fs
    .readdirSync(SQL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(SQL_DIR, file), "utf8");
    console.log(`[db] apply ${file}`);
    await client.query(sql);
  }

  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await client.query(
      `INSERT INTO users (username, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             display_name = EXCLUDED.display_name`,
      [u.username, hash, u.role, u.displayName],
    );
  }
  console.log(`[db] seeded ${USERS.length} users`);

  for (const [assetId, name, type, zone, status] of ASSETS) {
    // DO NOTHING so registry CRUD edits survive remigrate / API restart
    await client.query(
      `INSERT INTO assets (asset_id, name, type, zone, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (asset_id) DO NOTHING`,
      [assetId, name, type, zone, status],
    );
  }
  console.log(`[db] seeded ${ASSETS.length} assets`);

  await client.end();
  console.log("[db] migrate ok");

  try {
    await migrateTimescale();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[db] timescale migrate skipped/failed: ${message}`);
  }
}

const ranAsCli =
  Boolean(process.argv[1]) &&
  path.normalize(fileURLToPath(import.meta.url)) ===
    path.normalize(path.resolve(process.argv[1]));

if (ranAsCli) {
  migrateAndSeed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
