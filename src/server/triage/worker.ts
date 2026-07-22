import "server-only";

import type { Pool } from "pg";

import { claimNextTriageReport, DEFAULT_RECLAIM_INTERVAL, reclaimStuckTriageReports } from "./claim";
import { runTriageForReport } from "./service";

export const WORKER_POLL_INTERVAL_MS = 5_000;

export type WorkerDeps = {
  runTriage?: (reportId: string) => Promise<unknown>;
};

export async function runWorkerTick(
  pool: Pool,
  deps: WorkerDeps = {},
): Promise<void> {
  const runTriage = deps.runTriage ?? runTriageForReport;
  const client = await pool.connect();
  let reportId: string | null = null;

  try {
    await client.query("BEGIN");
    await reclaimStuckTriageReports(client, DEFAULT_RECLAIM_INTERVAL);
    const claimed = await claimNextTriageReport(client);
    await client.query("COMMIT");
    reportId = claimed?.report_id ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (reportId) {
    try {
      await runTriage(reportId);
    } catch (error) {
      console.error(`triage-worker: failed report ${reportId}`, error);
    }
  }
}

export async function runWorkerLoop(
  pool: Pool,
  options: { signal?: AbortSignal; deps?: WorkerDeps } = {},
): Promise<void> {
  while (!options.signal?.aborted) {
    await runWorkerTick(pool, options.deps);
    await sleep(WORKER_POLL_INTERVAL_MS, options.signal);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
