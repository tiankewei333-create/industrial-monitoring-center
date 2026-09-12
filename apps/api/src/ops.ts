import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import {
  DEFAULT_THRESHOLDS,
  type Thresholds,
} from "@imc/shared-types";
import { requireAdmin, requireUser } from "./auth.js";
import { writeAudit } from "./audit.js";

type SettingsRow = {
  value: Thresholds;
  updated_at: Date;
  updated_by: string | null;
};

type AssetThreshRow = {
  asset_id: string;
  temperature_max_c: number | null;
  power_max_kw: number | null;
  offline_timeout_sec: number | null;
};

type AuditRow = {
  id: string;
  at: Date;
  actor: string;
  role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
};

function parseGlobal(raw: unknown): Thresholds {
  const obj = raw && typeof raw === "object" ? (raw as Thresholds) : undefined;
  return {
    temperatureMaxC:
      Number(obj?.temperatureMaxC) || DEFAULT_THRESHOLDS.temperatureMaxC,
    powerMaxKw: Number(obj?.powerMaxKw) || DEFAULT_THRESHOLDS.powerMaxKw,
    offlineTimeoutSec:
      Number(obj?.offlineTimeoutSec) || DEFAULT_THRESHOLDS.offlineTimeoutSec,
  };
}

function readNumber(
  raw: unknown,
  min: number,
  max: number,
): number | undefined | "invalid" {
  if (raw === undefined) return undefined;
  if (raw === null) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return "invalid";
  return n;
}

export function registerOpsRoutes(app: FastifyInstance, pool: Pool) {
  app.get("/thresholds", async () => {
    const settings = await pool.query<SettingsRow>(
      `SELECT value, updated_at, updated_by FROM app_settings WHERE key = 'thresholds'`,
    );
    const global = parseGlobal(settings.rows[0]?.value);
    const assets = await pool.query<AssetThreshRow>(
      `SELECT asset_id, temperature_max_c, power_max_kw, offline_timeout_sec
       FROM assets
       ORDER BY asset_id ASC`,
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
      if (Object.keys(partial).length) overrides[row.asset_id] = partial;
    }
    return {
      global,
      overrides,
      updatedAt: settings.rows[0]?.updated_at?.toISOString() ?? null,
      updatedBy: settings.rows[0]?.updated_by ?? null,
    };
  });

  app.put<{
    Body: {
      temperatureMaxC?: number;
      powerMaxKw?: number;
      offlineTimeoutSec?: number;
    };
  }>("/thresholds", async (req, reply) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

    const currentRow = await pool.query<SettingsRow>(
      `SELECT value FROM app_settings WHERE key = 'thresholds'`,
    );
    const current = parseGlobal(currentRow.rows[0]?.value);

    const temp = readNumber(req.body?.temperatureMaxC, 1, 300);
    const power = readNumber(req.body?.powerMaxKw, 0.1, 10_000);
    const offline = readNumber(req.body?.offlineTimeoutSec, 5, 3600);
    if (temp === "invalid" || power === "invalid" || offline === "invalid") {
      return reply.code(400).send({ error: "invalid_threshold" });
    }

    const next: Thresholds = {
      temperatureMaxC: temp ?? current.temperatureMaxC,
      powerMaxKw: power ?? current.powerMaxKw,
      offlineTimeoutSec: offline ?? current.offlineTimeoutSec,
    };

    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at, updated_by)
       VALUES ('thresholds', $1::jsonb, now(), $2)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(next), auth.user.username],
    );
    await writeAudit(pool, {
      actor: auth.user.username,
      role: auth.user.role,
      action: "threshold_update",
      entityType: "settings",
      entityId: "thresholds",
      detail: next,
    });
    return { global: next };
  });

  app.put<{
    Params: { assetId: string };
    Body: {
      temperatureMaxC?: number | null;
      powerMaxKw?: number | null;
      offlineTimeoutSec?: number | null;
    };
  }>("/assets/:assetId/thresholds", async (req, reply) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

    const parseOptional = (
      raw: unknown,
      min: number,
      max: number,
    ): number | null | undefined | "invalid" => {
      if (raw === undefined) return undefined;
      if (raw === null || raw === "") return null;
      return readNumber(raw, min, max);
    };

    const temp = parseOptional(req.body?.temperatureMaxC, 1, 300);
    const power = parseOptional(req.body?.powerMaxKw, 0.1, 10_000);
    const offline = parseOptional(req.body?.offlineTimeoutSec, 5, 3600);
    if (temp === "invalid" || power === "invalid" || offline === "invalid") {
      return reply.code(400).send({ error: "invalid_threshold" });
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    if (temp !== undefined) {
      params.push(temp);
      sets.push(`temperature_max_c = $${params.length}`);
    }
    if (power !== undefined) {
      params.push(power);
      sets.push(`power_max_kw = $${params.length}`);
    }
    if (offline !== undefined) {
      params.push(offline);
      sets.push(`offline_timeout_sec = $${params.length}`);
    }
    if (sets.length === 0) {
      return reply.code(400).send({ error: "no_fields" });
    }
    sets.push(`updated_at = now()`);
    params.push(req.params.assetId);
    const r = await pool.query(
      `UPDATE assets SET ${sets.join(", ")}
       WHERE asset_id = $${params.length}
       RETURNING asset_id, temperature_max_c, power_max_kw, offline_timeout_sec`,
      params,
    );
    if (!r.rows[0]) {
      return reply.code(404).send({ error: "not_found" });
    }
    await writeAudit(pool, {
      actor: auth.user.username,
      role: auth.user.role,
      action: "asset_threshold_update",
      entityType: "asset",
      entityId: req.params.assetId,
      detail: req.body as Record<string, unknown>,
    });
    const row = r.rows[0] as AssetThreshRow;
    return {
      assetId: row.asset_id,
      override: {
        temperatureMaxC:
          row.temperature_max_c != null ? Number(row.temperature_max_c) : null,
        powerMaxKw: row.power_max_kw != null ? Number(row.power_max_kw) : null,
        offlineTimeoutSec:
          row.offline_timeout_sec != null
            ? Number(row.offline_timeout_sec)
            : null,
      },
    };
  });

  app.get<{
    Querystring: { limit?: string; action?: string; actor?: string };
  }>("/audit", async (req, reply) => {
    const auth = await requireUser(req.headers.authorization);
    if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));
    const params: unknown[] = [];
    const where: string[] = [];
    if (req.query.action?.trim()) {
      params.push(req.query.action.trim());
      where.push(`action = $${params.length}`);
    }
    if (req.query.actor?.trim()) {
      params.push(req.query.actor.trim());
      where.push(`actor = $${params.length}`);
    }
    params.push(limit);
    const r = await pool.query<AuditRow>(
      `SELECT id, at, actor, role, action, entity_type, entity_id, detail
       FROM audit_log
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY at DESC
       LIMIT $${params.length}`,
      params,
    );
    return {
      events: r.rows.map((row) => ({
        id: Number(row.id),
        at: row.at.toISOString(),
        actor: row.actor,
        role: row.role ?? undefined,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id ?? undefined,
        detail:
          row.detail && typeof row.detail === "object" ? row.detail : undefined,
      })),
    };
  });
}
