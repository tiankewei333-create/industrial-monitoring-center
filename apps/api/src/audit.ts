import type { Pool } from "pg";

export async function writeAudit(
  pool: Pool,
  entry: {
    actor: string;
    role?: string;
    action: string;
    entityType: string;
    entityId?: string;
    detail?: Record<string, unknown>;
  },
) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor, role, action, entity_type, entity_id, detail)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        entry.actor,
        entry.role ?? null,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        JSON.stringify(entry.detail ?? {}),
      ],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[api] writeAudit failed: ${message}`);
  }
}
