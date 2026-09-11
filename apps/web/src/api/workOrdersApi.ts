import type {
  WorkOrderPriority,
  WorkOrderRecord,
  WorkOrderStatus,
} from "@imc/shared-types";
import { API_URL } from "../auth/authApi";
import { getSession } from "../auth/authStorage";

function authHeaders(): HeadersInit {
  const session = getSession();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (session?.token) {
    headers.authorization = `Bearer ${session.token}`;
  }
  return headers;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: string;
      workOrderId?: string;
      hint?: string;
    };
    if (body.error === "work_order_exists" && body.workOrderId) {
      return `Work order already exists (${body.workOrderId})`;
    }
    if (body.error === "alarm_not_persisted") {
      return body.hint ?? "Alarm not in database yet — retry in a moment";
    }
    if (res.status === 401) return "Please sign in again";
    if (res.status === 403) return "Operator or admin role required";
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function listWorkOrders(opts?: {
  status?: WorkOrderStatus | "ALL";
}): Promise<WorkOrderRecord[]> {
  const qs = new URLSearchParams();
  if (opts?.status && opts.status !== "ALL") qs.set("status", opts.status);
  const res = await fetch(`${API_URL}/work-orders?${qs}`);
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { workOrders: WorkOrderRecord[] };
  return body.workOrders;
}

export async function createWorkOrder(input: {
  alarmId?: string;
  assetId?: string;
  title?: string;
  priority?: WorkOrderPriority;
  assignedTo?: string;
  note?: string;
}): Promise<WorkOrderRecord> {
  const res = await fetch(`${API_URL}/work-orders`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { workOrder: WorkOrderRecord };
  return body.workOrder;
}

export async function updateWorkOrder(
  workOrderId: string,
  patch: {
    status?: WorkOrderStatus;
    assignedTo?: string | null;
    note?: string;
    priority?: WorkOrderPriority;
    title?: string;
  },
): Promise<WorkOrderRecord> {
  const res = await fetch(
    `${API_URL}/work-orders/${encodeURIComponent(workOrderId)}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { workOrder: WorkOrderRecord };
  return body.workOrder;
}
