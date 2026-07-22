#!/usr/bin/env node
import { loadProjectEnv, requireEnvKeys } from "./load-project-env.mjs";

const env = loadProjectEnv();
const missing = requireEnvKeys(env, [
  "SUPABASE_DB_URL",
  "THIRD_PARTY_API_KEY",
  "AI_BASE_URL",
  "AI_MODEL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
]);

if (missing.length > 0) {
  console.error(`triage-worker: missing required env: ${missing.join(", ")}`);
  process.exit(1);
}

for (const [key, value] of Object.entries(env)) {
  if (value) {
    process.env[key] = value;
  }
}

const { createPgPool, runWorkerLoop } = await import("../src/server/triage/worker.ts");

const pool = createPgPool(env.SUPABASE_DB_URL);
const controller = new AbortController();

process.on("SIGINT", () => {
  console.log("triage-worker: shutting down");
  controller.abort();
});

console.log("triage-worker: started");
await runWorkerLoop({ pool }, { signal: controller.signal });
console.log("triage-worker: stopped");
