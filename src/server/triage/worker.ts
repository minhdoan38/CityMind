import "server-only";

import { Pool, type PoolClient } from "pg";

import { claimNextTriageReport, reclaimStuckTriageReports } from "./claim";
import { runTriageForReport } from "./service";

export const DEFAULT_POLL_INTERVAL_MS = 5_000;
export const DEFAULT_RECLAIM_INTERVAL = "15 minutes";

export type WorkerDeps = {
  pool: Pick<Pool, "connect">;
  runTriage?: typeof runTriageForReport;
  pollIntervalMs?: number;
  reclaimInterval?: string;
  sleep?: (ms: number) => Promise<void>;
};

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function workerTick(
  client: PoolClient,
  deps: Pick<WorkerDeps, "runTriage" | "reclaimInterval"> = {},
): Promise<string | null> {
  const runTriage = deps.runTriage ?? runTriageForReport;
  const reclaimInterval = deps.reclaimInterval ?? DEFAULT_RECLAIM_INTERVAL;

  await client.query("BEGIN");
  try {
    await reclaimStuckTriageReports(client, reclaimInterval);
    const claimed = await claimNextTriageReport(client);
    await client.query("COMMIT");

    if (!claimed) {
      return null;
    }

    try {
      await runTriage(claimed.report_id);
    } catch (error) {
      console.error(`triage worker: runTriageForReport failed for ${claimed.report_id}`, error);
    }

    return claimed.report_id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function runWorkerLoop(
  deps: WorkerDeps,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const sleep = deps.sleep ?? defaultSleep;
  const signal = options.signal;

  while (!signal?.aborted) {
    const client = await deps.pool.connect();
    try {
      await workerTick(client, deps);
    } finally {
      client.release();
    }

    if (signal?.aborted) {
      break;
    }

    await sleep(pollIntervalMs);
  }
}

export function createPgPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}
