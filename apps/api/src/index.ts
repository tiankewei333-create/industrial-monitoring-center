import Fastify from "fastify";
import cors from "@fastify/cors";
import bcrypt from "bcryptjs";
import type {
  AlarmRecord,
  AssetRecord,
  AssetStatus,
  AssetType,
  HistorySample,
  KpiOverview,
  KpiAssetRow,
} from "@imc/shared-types";
import { pingDb, pool } from "./db.js";
import { requireAdmin } from "./auth.js";
import { signAccessToken } from "./jwt.js";
import { migrateAndSeed } from "./migrate.js";
import {
  getTimescalePool,
  pingTimescale,
  timescaleEnabled,
} from "./timescale.js";
import { registerWorkOrderRoutes } from "./workOrders.js";

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const AUTO_MIGRATE = (process.env.DB_MIGRATE ?? "true").toLowerCase() !== "false";

const ASSET_TYPES: AssetType[] = [
  "CNC",
  "ROBOT",
  "CONVEYOR",
  "SENSOR",
  "WAREHOUSE",
  "ENERGY",
];
const ASSET_STATUSES: AssetStatus[] = ["OFFLINE", "IDLE", "RUNNING", "FAULT"];

type UserRow = {
  username: string;
  password_hash: string;
  role: "observer" | "operator" | "admin";
  display_name: string;
};

type AssetRow = {
  asset_id: string;
  name: string;
  type: string;
  zone: string;
  status: string;
  updated_at: Date;
};

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

function mapAsset(row: AssetRow): AssetRecord {
  return {
    assetId: row.asset_id,
    name: row.name,
    type: row.type as AssetRecord["type"],
    zone: row.zone,
    status: row.status as AssetRecord["status"],
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapAlarm(row: AlarmRow): AlarmRecord {
  return {
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
  };
}

function isAssetType(v: unknown): v is AssetType {
  return typeof v === "string" && (ASSET_TYPES as string[]).includes(v);
}

function isAssetStatus(v: unknown): v is AssetStatus {
  return typeof v === "string" && (ASSET_STATUSES as string[]).includes(v);
}

function parseRange(fromRaw?: string, toRaw?: string, defaultHours = 24) {
  const to = toRaw ? new Date(toRaw) : new Date();
  const from = fromRaw
    ? new Date(fromRaw)
    : new Date(to.getTime() - defaultHours * 3600_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return null;
  }
  const spanMs = to.getTime() - from.getTime();
  // Pick bucket so charts stay ~≤1500 points
  let bucket = "1 minute";
  if (spanMs <= 2 * 3600_000) bucket = "5 seconds";
  else if (spanMs <= 6 * 3600_000) bucket = "15 seconds";
  else if (spanMs <= 24 * 3600_000) bucket = "1 minute";
  else if (spanMs <= 3 * 86400_000) bucket = "5 minutes";
  else bucket = "15 minutes";
  return { from, to, bucket, spanMs };
}

async function main() {
  if (AUTO_MIGRATE) {
    await migrateAndSeed();
  }

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/health", async () => {
    let db = false;
    let timescale = false;
    try {
      db = await pingDb();
    } catch {
      db = false;
    }
    if (timescaleEnabled()) {
      try {
        timescale = await pingTimescale();
      } catch {
        timescale = false;
      }
    }
    return {
      ok: db,
      service: "imc-api",
      db,
      timescale,
      timescaleConfigured: timescaleEnabled(),
    };
  });

  app.post<{
    Body: { username?: string; password?: string };
  }>("/auth/login", async (req, reply) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!username || !password) {
      return reply.code(400).send({ error: "username_and_password_required" });
    }

    const r = await pool.query<UserRow>(
      `SELECT username, password_hash, role, display_name
       FROM users WHERE username = $1`,
      [username],
    );
    const user = r.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const token = await signAccessToken({
      username: user.username,
      role: user.role,
      displayName: user.display_name,
    });

    return {
      token,
      user: {
        username: user.username,
        role: user.role,
        displayName: user.display_name,
      },
    };
  });

  app.get("/assets", async () => {
    const r = await pool.query<AssetRow>(
      `SELECT asset_id, name, type, zone, status, updated_at
       FROM assets
       ORDER BY asset_id ASC`,
    );
    return { assets: r.rows.map(mapAsset) };
  });

  app.post<{
    Body: {
      assetId?: string;
      name?: string;
      type?: string;
      zone?: string;
      status?: string;
    };
  }>("/assets", async (req, reply) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

    const assetId = String(req.body?.assetId ?? "").trim();
    const name = String(req.body?.name ?? "").trim();
    const type = req.body?.type;
    const zone = String(req.body?.zone ?? "").trim();
    const status = req.body?.status ?? "OFFLINE";

    if (!assetId || !/^[A-Za-z0-9_-]{2,64}$/.test(assetId)) {
      return reply.code(400).send({ error: "invalid_asset_id" });
    }
    if (!name || name.length > 120) {
      return reply.code(400).send({ error: "invalid_name" });
    }
    if (!isAssetType(type)) {
      return reply.code(400).send({ error: "invalid_type" });
    }
    if (!zone || zone.length > 80) {
      return reply.code(400).send({ error: "invalid_zone" });
    }
    if (!isAssetStatus(status)) {
      return reply.code(400).send({ error: "invalid_status" });
    }

    try {
      const r = await pool.query<AssetRow>(
        `INSERT INTO assets (asset_id, name, type, zone, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         RETURNING asset_id, name, type, zone, status, updated_at`,
        [assetId, name, type, zone, status],
      );
      return reply.code(201).send({ asset: mapAsset(r.rows[0]) });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "23505") {
        return reply.code(409).send({ error: "asset_exists" });
      }
      throw err;
    }
  });

  app.patch<{
    Params: { assetId: string };
    Body: {
      name?: string;
      type?: string;
      zone?: string;
      status?: string;
    };
  }>("/assets/:assetId", async (req, reply) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

    const assetId = req.params.assetId;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name || name.length > 120) {
        return reply.code(400).send({ error: "invalid_name" });
      }
      params.push(name);
      sets.push(`name = $${params.length}`);
    }
    if (req.body?.type !== undefined) {
      if (!isAssetType(req.body.type)) {
        return reply.code(400).send({ error: "invalid_type" });
      }
      params.push(req.body.type);
      sets.push(`type = $${params.length}`);
    }
    if (req.body?.zone !== undefined) {
      const zone = String(req.body.zone).trim();
      if (!zone || zone.length > 80) {
        return reply.code(400).send({ error: "invalid_zone" });
      }
      params.push(zone);
      sets.push(`zone = $${params.length}`);
    }
    if (req.body?.status !== undefined) {
      if (!isAssetStatus(req.body.status)) {
        return reply.code(400).send({ error: "invalid_status" });
      }
      params.push(req.body.status);
      sets.push(`status = $${params.length}`);
    }

    if (sets.length === 0) {
      return reply.code(400).send({ error: "no_fields" });
    }

    sets.push(`updated_at = now()`);
    params.push(assetId);
    const r = await pool.query<AssetRow>(
      `UPDATE assets SET ${sets.join(", ")}
       WHERE asset_id = $${params.length}
       RETURNING asset_id, name, type, zone, status, updated_at`,
      params,
    );
    if (!r.rows[0]) {
      return reply.code(404).send({ error: "not_found" });
    }
    return { asset: mapAsset(r.rows[0]) };
  });

  app.delete<{
    Params: { assetId: string };
  }>("/assets/:assetId", async (req, reply) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

    const r = await pool.query(
      `DELETE FROM assets WHERE asset_id = $1 RETURNING asset_id`,
      [req.params.assetId],
    );
    if (!r.rowCount) {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.code(204).send();
  });

  app.get<{
    Querystring: {
      assetId?: string;
      from?: string;
      to?: string;
    };
  }>("/history", async (req, reply) => {
    const tsPool = getTimescalePool();
    if (!tsPool) {
      return reply.code(503).send({
        error: "timescale_unavailable",
        hint: "Set TIMESCALE_URL and run db:migrate",
      });
    }

    const assetId = String(req.query.assetId ?? "").trim();
    if (!assetId) {
      return reply.code(400).send({ error: "assetId_required" });
    }

    const range = parseRange(req.query.from, req.query.to, 24);
    if (!range) {
      return reply.code(400).send({ error: "invalid_range" });
    }

    const r = await tsPool.query<{
      ts: Date;
      temperature: number;
      speed: number;
      power: number;
      status: string;
    }>(
      `SELECT
         time_bucket($1::interval, ts) AS ts,
         avg(temperature)::float8 AS temperature,
         avg(speed)::float8 AS speed,
         avg(power)::float8 AS power,
         last(status, ts) AS status
       FROM telemetry
       WHERE asset_id = $2
         AND ts >= $3
         AND ts <= $4
       GROUP BY 1
       ORDER BY 1 ASC`,
      [range.bucket, assetId, range.from, range.to],
    );

    const samples: HistorySample[] = r.rows.map((row) => ({
      ts: row.ts.getTime(),
      temperature: Number(row.temperature),
      speed: Number(row.speed),
      power: Number(row.power),
      status: row.status as AssetStatus,
    }));

    return {
      assetId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      bucket: range.bucket,
      source: "timescale",
      samples,
    };
  });

  app.get<{
    Querystring: { from?: string; to?: string };
  }>("/kpi", async (req, reply) => {
    const tsPool = getTimescalePool();
    if (!tsPool) {
      return reply.code(503).send({
        error: "timescale_unavailable",
        hint: "Set TIMESCALE_URL and run db:migrate",
      });
    }

    const range = parseRange(req.query.from, req.query.to, 24);
    if (!range) {
      return reply.code(400).send({ error: "invalid_range" });
    }

    const r = await tsPool.query<{
      asset_id: string;
      samples: string;
      avg_temperature: number | null;
      avg_power: number | null;
      running: string;
      idle: string;
      fault: string;
      offline: string;
    }>(
      `SELECT
         asset_id,
         count(*)::text AS samples,
         avg(temperature)::float8 AS avg_temperature,
         avg(power)::float8 AS avg_power,
         sum(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END)::text AS running,
         sum(CASE WHEN status = 'IDLE' THEN 1 ELSE 0 END)::text AS idle,
         sum(CASE WHEN status = 'FAULT' THEN 1 ELSE 0 END)::text AS fault,
         sum(CASE WHEN status = 'OFFLINE' THEN 1 ELSE 0 END)::text AS offline
       FROM telemetry
       WHERE ts >= $1 AND ts <= $2
       GROUP BY asset_id
       ORDER BY asset_id ASC`,
      [range.from, range.to],
    );

    const assets: KpiAssetRow[] = r.rows.map((row) => {
      const samples = Number(row.samples);
      const running = Number(row.running);
      const fault = Number(row.fault);
      const idle = Number(row.idle);
      const offline = Number(row.offline);
      return {
        assetId: row.asset_id,
        samples,
        availability: samples > 0 ? running / samples : 0,
        faultRatio: samples > 0 ? fault / samples : 0,
        avgTemperature: row.avg_temperature != null ? Number(row.avg_temperature) : null,
        avgPower: row.avg_power != null ? Number(row.avg_power) : null,
        running,
        idle,
        fault,
        offline,
      };
    });

    const totalSamples = assets.reduce((s, a) => s + a.samples, 0);
    const totalRunning = assets.reduce((s, a) => s + a.running, 0);
    const totalFault = assets.reduce((s, a) => s + a.fault, 0);

    const overview: KpiOverview = {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      source: "timescale",
      assetCount: assets.length,
      sampleCount: totalSamples,
      availability: totalSamples > 0 ? totalRunning / totalSamples : 0,
      faultRatio: totalSamples > 0 ? totalFault / totalSamples : 0,
      assets,
    };

    return overview;
  });

  app.get<{
    Querystring: { state?: string; limit?: string };
  }>("/alarms", async (req) => {
    const state = req.query.state?.toUpperCase();
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));
    const params: unknown[] = [];
    let where = "";
    if (state && ["ACTIVE", "ACKED", "CLEARED"].includes(state)) {
      params.push(state);
      where = `WHERE state = $1`;
    }
    params.push(limit);
    const limIdx = params.length;
    const r = await pool.query<AlarmRow>(
      `SELECT alarm_id, asset_id, rule, severity, state, value, threshold,
              raised_at, acked_at, cleared_at, acked_by
       FROM alarms
       ${where}
       ORDER BY raised_at DESC
       LIMIT $${limIdx}`,
      params,
    );
    return { alarms: r.rows.map(mapAlarm) };
  });

  registerWorkOrderRoutes(app, pool);

  await app.listen({ port: PORT, host: HOST });
  console.log(`[api] http://127.0.0.1:${PORT}/health`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
