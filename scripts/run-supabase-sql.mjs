#!/usr/bin/env node
/**
 * Run a SQL file against the project's self-hosted Supabase Postgres via Supabase CLI.
 * Replaces native psql for Phase 7 migration/SQL gates.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadProjectEnv, requireEnvKeys, REPO_ROOT } from "./load-project-env.mjs";

function fail(message) {
  console.error(`run-supabase-sql: ${message}`);
  process.exit(1);
}

const fileArgIndex = process.argv.findIndex((arg) => arg === "-f" || arg === "--file");
const sqlFile =
  fileArgIndex !== -1 ? process.argv[fileArgIndex + 1] : process.argv[2];

if (!sqlFile) {
  fail("Usage: node scripts/run-supabase-sql.mjs -f <path-to.sql>");
}

const resolvedSql = path.resolve(REPO_ROOT, sqlFile);
if (!fs.existsSync(resolvedSql)) {
  fail(`SQL file not found: ${resolvedSql}`);
}

const env = loadProjectEnv();
const missing = requireEnvKeys(env, ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_DB_URL"]);
if (missing.length > 0) {
  fail(
    `Missing required env keys: ${missing.join(", ")}. Set them in .env.local (see .env.example).`
  );
}

const supabaseCmd = process.platform === "win32" ? "supabase.exe" : "supabase";
const result = spawnSync(
  supabaseCmd,
  ["db", "query", "--file", resolvedSql, "--db-url", env.SUPABASE_DB_URL],
  {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: "pipe",
    env: { ...process.env, ...env },
  }
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  fail(`supabase db query failed (exit ${result.status ?? "unknown"})`);
}

console.log(`run-supabase-sql: PASS (${path.relative(REPO_ROOT, resolvedSql)})`);
