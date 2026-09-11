import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type {
  WorkOrderPriority,
  WorkOrderRecord,
  WorkOrderStatus,
} from "@imc/shared-types";
import { requireStaff } from "./auth.js";

type WorkOrderRow = {
  work_order_id: string;
  alarm_id: string | null;
  asset_id: string;
  title: string;
  status: string;
  priority: string;
  created_by: string;
  assigned_to: string | null;
  note: string;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
};

const STATUSES: WorkOrderStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
];
const PRIORITIES: WorkOrderPriority[] = ["NORMAL", "HIGH"];

function mapWo(row: WorkOrderRow): WorkOrderRecord {
  return {
    workOrderId: row.work_order_id,
    alarmId: row.alarm_id ?? undefined,
    assetId: row.asset_id,
    title: row.title,
    status: row.status as WorkOrderStatus,
    priority: row.priority as WorkOrderPriority,
    createdBy: row.created_by,
    assignedTo: row.assigned_to ?? undefined,
    note: row.note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    closedAt: row.closed_at ? row.closed_at.toISOString() : undefined,
  };
}

function newWorkOrderId(): string {
  return `wo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function registerWorkOrderRoutes(app: FastifyInstance, pool: Pool) {
  app.get<{
    Querystring: { status?: string; assetId?: string; limit?: string };
  }>("/work-orders", async (req) => {
    const status = req.query.status?.toUpperCase();
    const assetId = req.query.assetId?.trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 100)));
    const params: unknown[] = [];
    const where: string[] = [];

    if (status && (STATUSES as string[]).includes(status)) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (assetId) {
      params.push(assetId);
      where.push(`asset_id = $${params.length}`);
    }
    params.push(limit);
    const r = await pool.query<WorkOrderRow>(
      `SELECT work_order_id, alarm_id, asset_id, title, status, priority,
              created_by, assigned_to, note, created_at, updated_at, closed_at
       FROM work_orders
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return { workOrders: r.rows.map(mapWo) };
  });

  app.post<{
    Body: {
      alarmId?: string;
      assetId?: string;
      title?: string;
      priority?: string;
      assignedTo?: string;
      note?: string;
    };
  }>("/work-orders", async (req, reply) => {
    const auth = await requireStaff(req.headers.authorization);
    if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

    let assetId = String(req.body?.assetId ?? "").trim();
    let title = String(req.body?.title ?? "").trim();
    const requestedAlarmId = String(req.body?.alarmId ?? "").trim() || null;
    let alarmId: string | null = null;

    const priorityRaw = String(req.body?.priority ?? "NORMAL").toUpperCase();
    const priority = (PRIORITIES as string[]).includes(priorityRaw)
      ? (priorityRaw as WorkOrderPriority)
      : "NORMAL";
    const assignedTo =
      String(req.body?.assignedTo ?? "").trim().slice(0, 64) || null;
    const note = String(req.body?.note ?? "").trim().slice(0, 2000);

    if (requestedAlarmId) {
      const alarm = await pool.query<{
        alarm_id: string;
        asset_id: string;
        rule: string;
        value: number;
      }>(
        `SELECT alarm_id, asset_id, rule, value FROM alarms WHERE alarm_id = $1`,
        [requestedAlarmId],
      );
      if (alarm.rows[0]) {
        alarmId = requestedAlarmId;
        assetId = assetId || alarm.rows[0].asset_id;
        if (!title) {
          title = `${alarm.rows[0].rule} on ${alarm.rows[0].asset_id} (${Number(alarm.rows[0].value).toFixed(1)}°C)`;
        }
        const dup = await pool.query<{ work_order_id: string }>(
          `SELECT work_order_id FROM work_orders WHERE alarm_id = $1`,
          [alarmId],
        );
        if (dup.rows[0]) {
          return reply.code(409).send({
            error: "work_order_exists",
            workOrderId: dup.rows[0].work_order_id,
          });
        }
      } else if (!assetId) {
        return reply.code(400).send({
          error: "alarm_not_persisted",
          hint: "Alarm not in Postgres yet — pass assetId or wait for upsert",
        });
      } else if (!title) {
        title = `Alarm follow-up · ${assetId}`;
      }
    }

    if (!assetId) {
      return reply.code(400).send({ error: "assetId_required" });
    }
    if (!title) {
      title = `Maintenance · ${assetId}`;
    }

    const asset = await pool.query(`SELECT 1 FROM assets WHERE asset_id = $1`, [
      assetId,
    ]);
    if (!asset.rowCount) {
      return reply.code(400).send({ error: "unknown_asset" });
    }

    const id = newWorkOrderId();
    try {
      const r = await pool.query<WorkOrderRow>(
        `INSERT INTO work_orders (
           work_order_id, alarm_id, asset_id, title, status, priority,
           created_by, assigned_to, note, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,'OPEN',$5,$6,$7,$8,now(),now())
         RETURNING work_order_id, alarm_id, asset_id, title, status, priority,
                   created_by, assigned_to, note, created_at, updated_at, closed_at`,
        [
          id,
          alarmId,
          assetId,
          title.slice(0, 200),
          priority,
          auth.user.username,
          assignedTo,
          note,
        ],
      );
      return reply.code(201).send({ workOrder: mapWo(r.rows[0]) });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "23505") {
        return reply.code(409).send({ error: "work_order_exists" });
      }
      throw err;
    }
  });

  app.patch<{
    Params: { workOrderId: string };
    Body: {
      status?: string;
      assignedTo?: string | null;
      note?: string;
      priority?: string;
      title?: string;
    };
  }>("/work-orders/:workOrderId", async (req, reply) => {
    const auth = await requireStaff(req.headers.authorization);
    if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

    const sets: string[] = [];
    const params: unknown[] = [];

    if (req.body?.status !== undefined) {
      const status = String(req.body.status).toUpperCase();
      if (!(STATUSES as string[]).includes(status)) {
        return reply.code(400).send({ error: "invalid_status" });
      }
      params.push(status);
      sets.push(`status = $${params.length}`);
      if (status === "DONE" || status === "CANCELLED") {
        sets.push(`closed_at = COALESCE(closed_at, now())`);
      } else {
        sets.push(`closed_at = NULL`);
      }
    }
    if (req.body?.priority !== undefined) {
      const priority = String(req.body.priority).toUpperCase();
      if (!(PRIORITIES as string[]).includes(priority)) {
        return reply.code(400).send({ error: "invalid_priority" });
      }
      params.push(priority);
      sets.push(`priority = $${params.length}`);
    }
    if (req.body?.assignedTo !== undefined) {
      const assigned =
        req.body.assignedTo === null
          ? null
          : String(req.body.assignedTo).trim().slice(0, 64) || null;
      params.push(assigned);
      sets.push(`assigned_to = $${params.length}`);
    }
    if (req.body?.note !== undefined) {
      params.push(String(req.body.note).trim().slice(0, 2000));
      sets.push(`note = $${params.length}`);
    }
    if (req.body?.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) return reply.code(400).send({ error: "invalid_title" });
      params.push(title.slice(0, 200));
      sets.push(`title = $${params.length}`);
    }

    if (sets.length === 0) {
      return reply.code(400).send({ error: "no_fields" });
    }

    sets.push(`updated_at = now()`);
    params.push(req.params.workOrderId);
    const r = await pool.query<WorkOrderRow>(
      `UPDATE work_orders SET ${sets.join(", ")}
       WHERE work_order_id = $${params.length}
       RETURNING work_order_id, alarm_id, asset_id, title, status, priority,
                 created_by, assigned_to, note, created_at, updated_at, closed_at`,
      params,
    );
    if (!r.rows[0]) {
      return reply.code(404).send({ error: "not_found" });
    }
    return { workOrder: mapWo(r.rows[0]) };
  });
}
