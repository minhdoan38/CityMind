import "server-only";

import type { PoolClient } from "pg";

export type ClaimedReportRow = {
  report_id: string;
};

export const DEFAULT_RECLAIM_INTERVAL = "15 minutes";

export async function reclaimStuckTriageReports(
  client: PoolClient,
  stuckInterval: string = DEFAULT_RECLAIM_INTERVAL,
): Promise<number> {
  const result = await client.query<{ reclaimed: string | number }>(
    "SELECT public.reclaim_stuck_triage_reports($1::interval) AS reclaimed",
    [stuckInterval],
  );
  return Number(result.rows[0]?.reclaimed ?? 0);
}

export async function claimNextTriageReport(
  client: PoolClient,
): Promise<ClaimedReportRow | null> {
  const result = await client.query<{ report_id: string }>(
    "SELECT report_id FROM public.claim_triage_report() LIMIT 1",
  );
  const row = result.rows[0];
  if (!row?.report_id) {
    return null;
  }
  return { report_id: String(row.report_id) };
}
