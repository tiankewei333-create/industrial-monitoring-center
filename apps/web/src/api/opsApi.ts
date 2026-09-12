import type { AuditRecord, Thresholds } from "@imc/shared-types";
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

async function fail(res: Response): Promise<never> {
  let err = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) err = body.error;
  } catch {
    /* ignore */
  }
  if (res.status === 401) err = "Please sign in again";
  if (res.status === 403) err = "Admin role required";
  throw new Error(err);
}

export type ThresholdsResponse = {
  global: Thresholds;
  overrides: Record<string, Partial<Thresholds>>;
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function fetchThresholds(): Promise<ThresholdsResponse> {
  const res = await fetch(`${API_URL}/thresholds`);
  if (!res.ok) await fail(res);
  return (await res.json()) as ThresholdsResponse;
}

export async function saveGlobalThresholds(
  body: Partial<Thresholds>,
): Promise<Thresholds> {
  const res = await fetch(`${API_URL}/thresholds`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  const data = (await res.json()) as { global: Thresholds };
  return data.global;
}

export async function saveAssetThresholds(
  assetId: string,
  body: {
    temperatureMaxC?: number | null;
    powerMaxKw?: number | null;
    offlineTimeoutSec?: number | null;
  },
): Promise<void> {
  const res = await fetch(
    `${API_URL}/assets/${encodeURIComponent(assetId)}/thresholds`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) await fail(res);
}

export async function fetchAudit(limit = 100): Promise<AuditRecord[]> {
  const res = await fetch(`${API_URL}/audit?limit=${limit}`, {
    headers: authHeaders(),
  });
  if (!res.ok) await fail(res);
  const data = (await res.json()) as { events: AuditRecord[] };
  return data.events;
}
