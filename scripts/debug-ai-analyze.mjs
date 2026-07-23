#!/usr/bin/env node
import { loadProjectEnv, REPO_ROOT } from "./load-project-env.mjs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const env = loadProjectEnv();
Object.assign(process.env, env);

const tsxCli = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const entry = path.join(REPO_ROOT, "scripts", "debug-ai-analyze.ts");

const result = spawnSync(process.execPath, [tsxCli, entry], {
  cwd: REPO_ROOT,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
