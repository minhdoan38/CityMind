#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./load-project-env.mjs";

const GATE_FILES = {
  "restore-and-rollback": path.join(
    REPO_ROOT,
    "migration-manifests",
    "restore-and-rollback-gate.json",
  ),
  source: path.join(
    REPO_ROOT,
    "migration-manifests",
    "source-access-and-backup-gate.json",
  ),
  "local-cleanup-approval": path.join(
    REPO_ROOT,
    "operations",
    "local-cleanup-approval.json",
  ),
};

function fail(message) {
  console.error(`verify-gate-artifacts: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const gateIndex = argv.findIndex((arg) => arg === "--gate");
  if (gateIndex === -1) fail("Usage: node verify-gate-artifacts.mjs --gate <name> [flags]");
  return {
    gateName: argv[gateIndex + 1],
    filePath: argv.includes("--file") ? argv[argv.indexOf("--file") + 1] : null,
    requireSigned: argv.includes("--require-signed"),
    requireDbRestore: argv.includes("--require-db-restore"),
    requireStorageRestore: argv.includes("--require-storage-restore"),
    requireManifestMatch: argv.includes("--require-manifest-match"),
    requireApplicationRollback: argv.includes("--require-application-rollback"),
    requireInventory: argv.includes("--require-inventory"),
    requireReconciliation: argv.includes("--require-reconciliation"),
    requireExplicitLocalCleanupApproval: argv.includes(
      "--require-explicit-local-cleanup-approval",
    ),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const gatePath =
    args.filePath ??
    GATE_FILES[args.gateName] ??
    (args.gateName?.endsWith(".json") ? path.resolve(REPO_ROOT, args.gateName) : null);
  if (!gatePath || !fs.existsSync(gatePath)) {
    fail(`gate file not found for ${args.gateName ?? args.filePath}`);
  }
  const gate = JSON.parse(fs.readFileSync(gatePath, "utf8"));

  if (args.requireSigned && !gate.signed) fail("gate is not signed");
  if (gate.status !== "PASS") fail(`gate status is ${gate.status ?? "unknown"}`);
  if (args.requireDbRestore && !gate.db_restore_hash) fail("db_restore_hash missing");
  if (args.requireStorageRestore && !gate.storage_restore_hash) {
    fail("storage_restore_hash missing");
  }
  if (args.requireManifestMatch && gate.manifest_match !== true) {
    fail("manifest_match is not true");
  }
  if (args.requireApplicationRollback && gate.application_rollback_pass !== true) {
    fail("application_rollback_pass is not true");
  }
  if (args.requireInventory && !gate.read_only_inventory?.reports?.length) {
    fail("read_only_inventory.reports missing");
  }
  if (args.requireReconciliation && gate.status !== "PASS") {
    fail("reconciliation evidence missing PASS");
  }
  if (
    args.requireExplicitLocalCleanupApproval &&
    gate.explicitLocalCleanupApproval !== true
  ) {
    fail("explicit local cleanup approval missing");
  }

  console.log(`verify-gate-artifacts: PASS (${args.gateName})`);
}

main();
