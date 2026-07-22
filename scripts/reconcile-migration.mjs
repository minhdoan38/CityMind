#!/usr/bin/env node
/**
 * Build or verify the signed migration reconciliation manifest.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, requireEnvKeys } from "./load-project-env.mjs";
import { buildReconciliationManifest, stableStringify } from "./lib/reconciliation.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const GATE_PATH = path.join(
  ROOT,
  "frontend",
  "migration-manifests",
  "source-access-and-backup-gate.json",
);
const OUTPUT_PATH = path.join(
  ROOT,
  "frontend",
  "migration-manifests",
  "reconciliation.json",
);

function fail(message) {
  console.error(`reconcile-migration: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  return {
    requirePass: argv.includes("--require-pass"),
    requireSigned: argv.includes("--require-signed"),
    write: argv.includes("--write"),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function gitRevision() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function queryRows(env) {
  const missing = requireEnvKeys(env, ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
  if (missing.length > 0) {
    fail(`missing env keys: ${missing.join(", ")}`);
  }
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .from("reports")
    .select("report_id, created_at, category, current_status, evidence_path")
    .order("report_id");
  if (error) fail(error.message);
  return data ?? [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(GATE_PATH)) {
    fail(`missing gate manifest: ${GATE_PATH}`);
  }

  const gate = readJson(GATE_PATH);
  if (!gate.read_only_inventory) {
    fail("gate.read_only_inventory is required");
  }
  if (args.requireSigned && !gate.signed) {
    fail("source-access-and-backup-gate.json is not signed");
  }
  if (gate.status !== "PASS") {
    fail(`source gate status is ${gate.status ?? "unknown"}, expected PASS`);
  }

  const env = loadProjectEnv();
  const targetRows = await queryRows(env);
  const sourceRows = gate.read_only_inventory.reports ?? [];
  const sourceObjects = gate.read_only_inventory.storage_objects ?? [];
  const targetObjects = gate.read_only_inventory.target_storage_objects ?? sourceObjects;

  const manifest = buildReconciliationManifest({
    sourceRows,
    targetRows,
    sourceObjects,
    targetObjects,
    targetEvidencePathCount: targetRows.filter((row) => row.evidence_path).length,
    targetGsUriCount: 0,
    signed: gate.signed,
    signer: gate.signer,
    signedAt: gate.signedAt,
    gitRevision: gitRevision(),
  });

  if (args.write || !fs.existsSync(OUTPUT_PATH)) {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`reconcile-migration: wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
  }

  if (args.requirePass && manifest.status !== "PASS") {
    fail(`reconciliation status ${manifest.status}`);
  }
  if (args.requireSigned && !manifest.signed) {
    fail("reconciliation manifest is not signed");
  }

  console.log(`reconcile-migration: ${manifest.status}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
