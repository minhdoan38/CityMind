#!/usr/bin/env node
/**
 * Cutover gate: exit 0 only when eval results pass thresholds and manifest match.
 */
import fs from "node:fs";
import path from "node:path";

import { loadProjectEnv, REPO_ROOT } from "./load-project-env.mjs";

function fail(message) {
  console.error(`verify-eval-gate: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const resultsIndex = argv.indexOf("--results");
  const manifestIndex = argv.indexOf("--manifest");
  return {
    resultsPath:
      resultsIndex === -1
        ? path.join(REPO_ROOT, "evals/results/latest.json")
        : path.resolve(REPO_ROOT, argv[resultsIndex + 1]),
    manifestPath:
      manifestIndex === -1
        ? path.resolve(
            REPO_ROOT,
            process.env.EVAL_MANIFEST_PATH ??
              "evals/manifests/phase10-baseline-vs-candidate.json",
          )
        : path.resolve(REPO_ROOT, argv[manifestIndex + 1]),
  };
}

function resolveEnvPlaceholder(value, env) {
  return String(value).replace(/\$\{([A-Z0-9_]+)\}/g, (_match, key) => env[key] ?? "");
}

function main() {
  loadProjectEnv();
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.resultsPath)) {
    fail(`results file not found: ${args.resultsPath}`);
  }
  if (!fs.existsSync(args.manifestPath)) {
    fail(`manifest file not found: ${args.manifestPath}`);
  }

  let results;
  let manifest;
  try {
    results = JSON.parse(fs.readFileSync(args.resultsPath, "utf8"));
    manifest = JSON.parse(fs.readFileSync(args.manifestPath, "utf8"));
  } catch {
    fail("unable to parse results or manifest JSON");
  }

  if (typeof results.status !== "string") {
    fail("results missing status field");
  }
  if (typeof results.manifest_id !== "string") {
    fail("results missing manifest_id field");
  }
  if (!results.metrics || typeof results.metrics !== "object") {
    fail("results missing metrics object");
  }

  if (results.manifest_id !== manifest.manifest_id) {
    fail(
      `manifest_id mismatch: results=${results.manifest_id} manifest=${manifest.manifest_id}`,
    );
  }

  if (results.status !== "PASS") {
    fail(`eval status is ${results.status ?? "unknown"}`);
  }

  const parityEpsilon = manifest.parity_epsilon ?? 0.05;
  const localeDelta = results.metrics.locale_parity_delta;
  if (typeof localeDelta === "number" && localeDelta > parityEpsilon) {
    fail(`EN/VI parity delta ${localeDelta} exceeds epsilon ${parityEpsilon}`);
  }

  const baselineFailure = results.baseline?.failure_rate;
  const candidateFailure = results.metrics.failure_rate;
  const baselineUnderTriage =
    results.baseline?.under_triage_rate ?? results.metrics.under_triage_rate;
  const candidateUnderTriage = results.metrics.under_triage_rate;

  if (
    typeof candidateFailure === "number" &&
    typeof baselineFailure === "number" &&
    candidateFailure > baselineFailure
  ) {
    fail(
      `candidate failure_rate ${candidateFailure} exceeds baseline ${baselineFailure}`,
    );
  }

  if (
    typeof candidateUnderTriage === "number" &&
    typeof baselineUnderTriage === "number" &&
    candidateUnderTriage > baselineUnderTriage
  ) {
    fail(
      `candidate under_triage_rate ${candidateUnderTriage} exceeds baseline ${baselineUnderTriage}`,
    );
  }

  const resolvedBaselineModel = resolveEnvPlaceholder(
    manifest.baseline?.ai_model ?? "",
    process.env,
  );
  const resolvedCandidateModel = resolveEnvPlaceholder(
    manifest.candidate?.ai_model ?? "",
    process.env,
  );

  if (
    results.baseline?.ai_model &&
    resolvedBaselineModel &&
    results.baseline.ai_model !== resolvedBaselineModel
  ) {
    fail("baseline model in results does not match resolved manifest");
  }

  if (
    results.candidate?.ai_model &&
    resolvedCandidateModel &&
    results.candidate.ai_model !== resolvedCandidateModel &&
    resolvedCandidateModel.trim() !== ""
  ) {
    fail("candidate model in results does not match resolved manifest");
  }

  console.log(`verify-eval-gate: PASS (${results.manifest_id})`);
}

main();
