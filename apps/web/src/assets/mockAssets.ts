import type { AssetRecord, AssetStatus, AssetType } from "@imc/shared-types";
import { API_URL } from "../auth/authApi";
import { getSession } from "../auth/authStorage";

/** Local registry seed until API/Postgres is reachable. */
export const MOCK_ASSETS: AssetRecord[] = [
  {
    assetId: "Machine001",
    name: "CNC Lathe A1",
    type: "CNC",
    zone: "Line-A",
    status: "RUNNING",
    updatedAt: "2026-09-11T02:00:00.000Z",
  },
  {
    assetId: "Machine002",
    name: "CNC Mill A2",
    type: "CNC",
    zone: "Line-A",
    status: "IDLE",
    updatedAt: "2026-09-11T02:00:00.000Z",
  },
  {
    assetId: "Robot001",
    name: "Six-Axis Arm B1",
    type: "ROBOT",
    zone: "Line-B",
    status: "RUNNING",
    updatedAt: "2026-09-11T02:00:00.000Z",
  },
  {
    assetId: "Robot002",
    name: "Pick-Place Arm B2",
    type: "ROBOT",
    zone: "Line-B",
    status: "FAULT",
    updatedAt: "2026-09-11T01:58:00.000Z",
  },
  {
    assetId: "Conveyor001",
    name: "Main Belt C1",
    type: "CONVEYOR",
    zone: "Transfer",
    status: "RUNNING",
    updatedAt: "2026-09-11T02:00:00.000Z",
  },
  {
    assetId: "Sensor001",
    name: "Temp Node T1",
    type: "SENSOR",
    zone: "Line-A",
    status: "RUNNING",
    updatedAt: "2026-09-11T02:00:00.000Z",
  },
  {
    assetId: "Warehouse001",
    name: "Buffer Rack W1",
    type: "WAREHOUSE",
    zone: "Storage",
    status: "IDLE",
    updatedAt: "2026-09-11T01:45:00.000Z",
  },
  {
    assetId: "Energy001",
    name: "Workshop PDU E1",
    type: "ENERGY",
    zone: "Utility",
    status: "RUNNING",
    updatedAt: "2026-09-11T02:00:00.000Z",
  },
];

export type AssetWriteInput = {
  assetId: string;
  name: string;
  type: AssetType;
  zone: string;
  status?: AssetStatus;
};

export type AssetPatchInput = {
  name?: string;
  type?: AssetType;
  zone?: string;
  status?: AssetStatus;
};

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

function apiErrorMessage(status: number, body: unknown): string {
  const err =
    body && typeof body === "object" && "error" in body
      ? String((body as { error: string }).error)
      : "";
  if (status === 401) return "Please sign in again (API auth required).";
  if (status === 403) return "Admin role required to change the registry.";
  if (status === 409 || err === "asset_exists") return "Asset ID already exists.";
  if (status === 404) return "Asset not found.";
  if (err) return err;
  return `Request failed (${status})`;
}

export async function listAssets(): Promise<AssetRecord[]> {
  try {
    const res = await fetch(`${API_URL}/assets`);
    if (res.ok) {
      const body = (await res.json()) as { assets: AssetRecord[] };
      if (Array.isArray(body.assets) && body.assets.length > 0) {
        return body.assets;
      }
    }
  } catch (err) {
    console.warn("[assets] API unreachable, using mock registry", err);
  }
  return MOCK_ASSETS.map((a) => ({ ...a }));
}

export async function createAsset(
  input: AssetWriteInput,
): Promise<AssetRecord> {
  const res = await fetch(`${API_URL}/assets`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new Error(apiErrorMessage(res.status, body));
  }
  const body = (await res.json()) as { asset: AssetRecord };
  return body.asset;
}

export async function updateAsset(
  assetId: string,
  patch: AssetPatchInput,
): Promise<AssetRecord> {
  const res = await fetch(`${API_URL}/assets/${encodeURIComponent(assetId)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new Error(apiErrorMessage(res.status, body));
  }
  const body = (await res.json()) as { asset: AssetRecord };
  return body.asset;
}

export async function deleteAsset(assetId: string): Promise<void> {
  const res = await fetch(`${API_URL}/assets/${encodeURIComponent(assetId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new Error(apiErrorMessage(res.status, body));
  }
}

/** @deprecated use listAssets */
export function listMockAssets(): Promise<AssetRecord[]> {
  return listAssets();
}
