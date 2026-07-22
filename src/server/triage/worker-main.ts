import pg from "pg";

import { runWorkerLoop } from "./worker";

async function main(): Promise<void> {
  const connectionString = process.env.SUPABASE_DB_URL?.trim();
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is required for triage worker");
  }

  const pool = new pg.Pool({ connectionString });
  const controller = new AbortController();

  const shutdown = () => {
    console.info("triage-worker: shutting down");
    controller.abort();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.info("triage-worker: started");
  try {
    await runWorkerLoop(pool, { signal: controller.signal });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("triage-worker:", error);
  process.exit(1);
});
