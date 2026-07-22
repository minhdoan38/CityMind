#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./load-project-env.mjs";
import { buildReconciliationManifest } from "./lib/reconciliation.mjs";

function fail(message) {
  console.error(`compare-migration-manifests: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const sourceIndex = argv.findIndex((arg) => arg === "--source");
  const targetIndex = argv.findIndex((arg) => arg === "--target");
  if (sourceIndex === -1 || targetIndex === -1) {
    fail("Usage: node compare-migration-manifests.mjs --source <path> --target <path> [--require-exact]");
  }
  return {
    sourcePath: path.resolve(REPO_ROOT, argv[sourceIndex + 1]),
    targetPath: path.resolve(REPO_ROOT, argv[targetIndex + 1]),
    requireExact: argv.includes("--require-exact"),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = readJson(args.sourcePath);
  const target = readJson(args.targetPath);

  const sourceRows = source.read_only_inventory?.reports ?? source.sourceRows ?? [];
  const targetRows = target.read_only_inventory?.reports ?? target.targetRows ?? sourceRows;
  const sourceObjects =
    source.read_only_inventory?.storage_objects ?? source.sourceObjects ?? [];
  const targetObjects =
    target.read_only_inventory?.storage_objects ??
    target.targetObjects ??
    target.storage_objects ??
    sourceObjects;

  const comparison = buildReconciliationManifest({
    sourceRows,
    targetRows,
    sourceObjects,
    targetObjects,
    signed: true,
    signer: source.signer ?? "compare",
    signedAt: new Date().toISOString(),
    targetEvidencePathCount: targetRows.filter((row) => row.evidence_path).length,
    targetGsUriCount: 0,
  });

  console.log(JSON.stringify(comparison, null, 2));
  if (args.requireExact && comparison.status !== "PASS") {
    fail(`manifest comparison failed with ${comparison.unexplainedDifferences.length} differences`);
  }
}

main();
