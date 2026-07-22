#!/usr/bin/env node
/**
 * Offline/live triage eval suite CLI.
 * CI must use --mock (default). Live mode is operator-only.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv, REPO_ROOT } from "./load-project-env.mjs";

function fail(message) {
  console.error(`eval-suite: ${message}`);
  process.exit(2);
}

const env = loadProjectEnv();
Object.assign(process.env, env);

const tsxCli = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
if (!fs.existsSync(tsxCli)) {
  fail("tsx is not installed — run npm install");
}

const entry = path.join(REPO_ROOT, "src", "server", "evals", "eval-suite-runner.ts");
const result = spawnSync(process.execPath, [tsxCli, entry, ...process.argv.slice(2)], {
  cwd: REPO_ROOT,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
