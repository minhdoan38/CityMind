#!/usr/bin/env node
/**
 * Production/dev entrypoint for the async triage worker.
 * Loads project env, then runs the TypeScript worker loop via local tsx.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv, requireEnvKeys, REPO_ROOT } from "./load-project-env.mjs";

function fail(message) {
  console.error(`triage-worker: ${message}`);
  process.exit(1);
}

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
  fail(`Missing required env keys: ${missing.join(", ")}`);
}

Object.assign(process.env, env);

const tsxCli = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
if (!fs.existsSync(tsxCli)) {
  fail("tsx is not installed — run npm install");
}

const entry = path.join(REPO_ROOT, "src", "server", "triage", "worker-main.ts");
const result = spawnSync(process.execPath, [tsxCli, entry], {
  cwd: REPO_ROOT,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
