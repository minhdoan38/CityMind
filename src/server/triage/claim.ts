import "server-only";

import type { PoolClient } from "pg";

export type ClaimedReport = {
  report_id: string;
};

export async function reclaimStuckTriageReports(
  client: PoolClient,
  stuckInterval = "15 minutes",
): Promise<number> {
  const result = await client.query(
    "SELECT public.reclaim_stuck_triage_reports($1::interval) AS reclaimed",
    [stuckInterval],
  );
  return Number(result.rows[0]?.reclaimed ?? 0);
}

export async function claimNextTriageReport(
  client: PoolClient,
): Promise<ClaimedReport | null> {
  const result = await client.query("SELECT * FROM public.claim_triage_report()");
  const row = result.rows[0] as { report_id?: string } | undefined;
  if (!row?.report_id) {
    return null;
  }
  return { report_id: String(row.report_id) };
}
