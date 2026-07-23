#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./load-project-env.mjs";

const env = loadProjectEnv();
const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await client
  .from("triage_attempts")
  .select("disposition, raw_output, validation_errors, latency_ms, created_at, triage_runs(report_id)")
  .order("created_at", { ascending: false })
  .limit(5);

if (error) {
  console.error("query error:", error.message);
  process.exit(1);
}

for (const row of data ?? []) {
  console.log("---");
  console.log("report:", row.triage_runs?.report_id);
  console.log("disposition:", row.disposition);
  console.log("latency_ms:", row.latency_ms);
  console.log("validation:", JSON.stringify(row.validation_errors));
  console.log("raw:", String(row.raw_output ?? "").slice(0, 400));
}

const { data: reports, error: reportsError } = await client
  .from("reports")
  .select("report_id, triage_status, triage_attempt_count, triage_next_attempt_at, received_at")
  .order("received_at", { ascending: false })
  .limit(5);

if (reportsError) {
  console.error("reports error:", reportsError.message);
}

console.log("\nRecent reports:");
for (const row of reports ?? []) {
  console.log(row);
}
