#!/usr/bin/env node
/**
 * Google-exit / legacy-runtime audit for Phase 7 cleanup gate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAuditReport,
  buildLegacyInventory,
  normalizeRelPath,
  scanDependencies,
  scanEnvExample,
  scanFileContent,
  validateSafetyEvidence,
} from "./lib/google-exit-audit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_DIR = path.join(ROOT, "migration-manifests");
const DEFAULT_OUTPUT = path.join(MANIFEST_DIR, "google-exit-pre-clean.json");

const SCAN_ROOTS = [
  path.join(ROOT, "src"),
  path.join(ROOT, "scripts"),
  path.join(ROOT, ".env.example"),
];

function fail(message) {
  console.error(`google-exit-audit: ${message}`);
  process.exit(1);
}

const DOC_SCAN_ROOTS = [
  path.join(ROOT, "..", "README.md"),
  path.join(ROOT, "..", "AGENTS.md"),
  path.join(ROOT, "..", ".planning", "codebase"),
];

function parseArgs(argv) {
  const modeIndex = argv.findIndex((arg) => arg === "--mode");
  const outputIndex = argv.findIndex((arg) => arg === "--output");
  return {
    mode: modeIndex !== -1 ? argv[modeIndex + 1] : "strict",
    writeManifest: argv.includes("--write-manifest"),
    requireAllSignedEvidence: argv.includes("--require-all-signed-evidence"),
    output:
      outputIndex !== -1
        ? path.resolve(ROOT, argv[outputIndex + 1])
        : DEFAULT_OUTPUT,
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectFiles(targetPath, files = []) {
  if (!fs.existsSync(targetPath)) return files;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    files.push(targetPath);
    return files;
  }
  for (const entry of fs.readdirSync(targetPath)) {
    if (
      entry === "node_modules" ||
      entry === ".next" ||
      entry === ".venv" ||
      entry === ".pytest_cache"
    ) {
      continue;
    }
    collectFiles(path.join(targetPath, entry), files);
  }
  return files;
}

function isTextFile(filePath) {
  return /\.(ts|tsx|js|mjs|cjs|json|md|py|sql|yml|yaml|css|ps1|example|env)$/i.test(
    filePath,
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scanRoots = args.mode === "docs" ? DOC_SCAN_ROOTS : SCAN_ROOTS;
  const allFiles = scanRoots.flatMap((target) => collectFiles(target));
  const relPaths = [];
  const findings = [];

  for (const filePath of allFiles) {
    if (!isTextFile(filePath)) continue;
    const relPath = normalizeRelPath(filePath, ROOT);
    relPaths.push(relPath);
    const content = fs.readFileSync(filePath, "utf8");
    findings.push(...scanFileContent(relPath, content));
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
  );
  const dependencyFindings = scanDependencies(packageJson);
  const envExamplePath = path.join(ROOT, ".env.example");
  const envKeyFindings = fs.existsSync(envExamplePath)
    ? scanEnvExample(fs.readFileSync(envExamplePath, "utf8"))
    : [];

  const safetyEvidence = validateSafetyEvidence({
    sourceGate: readJsonIfExists(
      path.join(MANIFEST_DIR, "source-access-and-backup-gate.json"),
    ),
    reconciliation: readJsonIfExists(path.join(MANIFEST_DIR, "reconciliation.json")),
    restoreGate: readJsonIfExists(
      path.join(MANIFEST_DIR, "restore-and-rollback-gate.json"),
    ),
  });

  const legacyInventory = buildLegacyInventory(relPaths);
  const report = buildAuditReport({
    mode: args.mode,
    findings,
    legacyInventory,
    safetyEvidence,
    dependencyFindings,
    envKeyFindings,
    requireAllSignedEvidence: args.requireAllSignedEvidence,
  });

  if (args.writeManifest) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.error(`google-exit-audit: wrote ${path.relative(ROOT, args.output)}`);
  }

  console.log(JSON.stringify(report, null, 2));

  if (report.status !== "PASS") {
    process.exit(1);
  }
}

main();
