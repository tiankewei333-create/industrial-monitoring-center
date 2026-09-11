import { API_URL } from "../auth/authApi";
import type { HistorySample, KpiOverview } from "@imc/shared-types";

export type HistoryRangeHours = 1 | 6 | 24;

export type HistoryQueryResult = {
  assetId: string;
  from: string;
  to: string;
  bucket: string;
  source: string;
  samples: HistorySample[];
};

export async function fetchHistory(
  assetId: string,
  hours: HistoryRangeHours,
): Promise<HistoryQueryResult> {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 3600_000);
  const qs = new URLSearchParams({
    assetId,
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await fetch(`${API_URL}/history?${qs}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `history_failed_${res.status}`);
  }
  return (await res.json()) as HistoryQueryResult;
}

export async function fetchKpi(hours: HistoryRangeHours): Promise<KpiOverview> {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 3600_000);
  const qs = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await fetch(`${API_URL}/kpi?${qs}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `kpi_failed_${res.status}`);
  }
  return (await res.json()) as KpiOverview;
}
