import path from "node:path";
import { pathToFileURL } from "node:url";

import { ROUTING_POLICY_VERSION } from "../routing/policy";

import {
  aggregateOutcomes,
  loadEvaluatorThresholds,
  passesThresholds,
} from "./aggregate";
import { loadDataset } from "./load-dataset";
import { runCase } from "./run-case";
import type { EvalManifest } from "./types";

export type EvalSuiteOptions = {
  manifestPath: string;
  datasetPath?: string;
  injectionPath?: string;
  mode: "mock" | "live";
  repetitions: number;
  resultsDir: string;
  repoRoot: string;
  analyzeStructured?: import("./run-case").AnalyzeStructuredFn;
};

export type EvalSuiteResult = {
  status: "PASS" | "FAIL";
  manifest_id: string;
  baseline: EvalManifest["baseline"] & {
    failure_rate?: number;
    under_triage_rate?: number;
  };
  candidate: EvalManifest["candidate"] & {
    failure_rate?: number;
    under_triage_rate?: number;
  };
  metrics: ReturnType<typeof aggregateOutcomes>;
  threshold_result: ReturnType<typeof passesThresholds>;
  case_count: number;
  mode: "mock" | "live";
  repetitions: number;
  signed_at: string;
  results_path: string;
  latest_path: string;
};

function resolveEnvPlaceholder(value: string, env: NodeJS.ProcessEnv): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, key: string) => env[key] ?? "");
}

function resolveManifestLineage(
  lineage: EvalManifest["baseline"],
  env: NodeJS.ProcessEnv,
): EvalManifest["baseline"] {
  return {
    ai_base_url: resolveEnvPlaceholder(lineage.ai_base_url, env),
    ai_model: resolveEnvPlaceholder(lineage.ai_model, env),
    prompt_version: lineage.prompt_version,
    routing_policy_version: lineage.routing_policy_version || ROUTING_POLICY_VERSION,
  };
}

export async function loadManifest(manifestPath: string): Promise<EvalManifest> {
  const { readFileSync } = await import("node:fs");
  const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as EvalManifest;
  return {
    ...raw,
    baseline: {
      ...raw.baseline,
      routing_policy_version: raw.baseline.routing_policy_version || ROUTING_POLICY_VERSION,
    },
    candidate: {
      ...raw.candidate,
      routing_policy_version: raw.candidate.routing_policy_version || ROUTING_POLICY_VERSION,
    },
  };
}

export async function runEvalSuite(options: EvalSuiteOptions): Promise<EvalSuiteResult> {
  const { mkdirSync, writeFileSync } = await import("node:fs");

  const manifest = await loadManifest(options.manifestPath);
  const datasetPath =
    options.datasetPath ?? path.resolve(options.repoRoot, manifest.dataset);
  const injectionPath =
    options.injectionPath ??
    path.resolve(options.repoRoot, "evals/datasets/injection-adversarial.jsonl");

  const datasetResult = await loadDataset(datasetPath);
  if (!datasetResult.ok) {
    throw new Error(
      `Dataset load failed: ${datasetResult.errors.map((item) => item.message).join(", ")}`,
    );
  }

  const injectionResult = await loadDataset(injectionPath);
  if (!injectionResult.ok) {
    throw new Error(
      `Injection dataset load failed: ${injectionResult.errors.map((item) => item.message).join(", ")}`,
    );
  }

  const allCases = [...datasetResult.cases, ...injectionResult.cases];
  const outcomes = [];

  for (const evalCase of allCases) {
    const repetitions = await runCase(evalCase, {
      mode: options.mode,
      repetitions: options.repetitions,
      analyzeStructured: options.analyzeStructured,
    });

    outcomes.push({
      case_id: evalCase.case_id,
      locale: evalCase.locale,
      gold: evalCase.gold,
      tags: evalCase.tags,
      report_text: evalCase.report_text,
      repetitions,
    });
  }

  const metrics = aggregateOutcomes(outcomes, {
    singleRepetition: options.repetitions <= 1,
  });
  const thresholds = loadEvaluatorThresholds(
    path.resolve(options.repoRoot, manifest.evaluator_config),
  );
  const thresholdResult = passesThresholds(metrics, thresholds);

  const baseline = resolveManifestLineage(manifest.baseline, process.env);
  const candidate = resolveManifestLineage(manifest.candidate, process.env);

  const signedAt = new Date().toISOString();
  const payload: EvalSuiteResult = {
    status: thresholdResult.pass ? "PASS" : "FAIL",
    manifest_id: manifest.manifest_id,
    baseline: {
      ...baseline,
      failure_rate: metrics.failure_rate,
      under_triage_rate: metrics.under_triage_rate,
    },
    candidate: {
      ...candidate,
      failure_rate: metrics.failure_rate,
      under_triage_rate: metrics.under_triage_rate,
    },
    metrics,
    threshold_result: thresholdResult,
    case_count: allCases.length,
    mode: options.mode,
    repetitions: options.repetitions,
    signed_at: signedAt,
    results_path: "",
    latest_path: "",
  };

  mkdirSync(options.resultsDir, { recursive: true });
  const runPath = path.join(options.resultsDir, `run-${signedAt.replace(/[:.]/g, "-")}.json`);
  const latestPath = path.join(options.resultsDir, "latest.json");
  payload.results_path = runPath;
  payload.latest_path = latestPath;

  writeFileSync(runPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(latestPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return payload;
}

export async function runEvalSuiteCliWithRoot(argv: string[], repoRoot: string): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`Usage: node scripts/eval-suite.mjs [flags]

Flags:
  --mock                      Run with deterministic fixtures (default; CI-safe)
  --live                      Call live AI provider (operator-only; never in CI)
  --require-privacy-approval  Interactive gate before live API calls
  --manifest <path>           Pinned eval manifest (default: evals/manifests/phase10-baseline-vs-candidate.json)
  --dataset <path>            Override primary dataset JSONL
  --repetitions <n>           Repetitions per case (default: 1 mock, 5 live)
  --candidate                 Overlay AI_MODEL_CANDIDATE in results lineage

CI must use --mock only.`);
    return 0;
  }

  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  const mode = flags.has("--live") ? "live" : "mock";
  const repetitionsDefault = mode === "live" ? 5 : 1;

  const manifestArgIndex = argv.indexOf("--manifest");
  const datasetArgIndex = argv.indexOf("--dataset");
  const repetitionsArgIndex = argv.indexOf("--repetitions");

  const manifestPath = path.resolve(
    repoRoot,
    manifestArgIndex === -1
      ? "evals/manifests/phase10-baseline-vs-candidate.json"
      : argv[manifestArgIndex + 1]!,
  );

  const datasetPath =
    datasetArgIndex === -1
      ? undefined
      : path.resolve(repoRoot, argv[datasetArgIndex + 1]!);

  const repetitions =
    repetitionsArgIndex === -1
      ? repetitionsDefault
      : Number.parseInt(argv[repetitionsArgIndex + 1] ?? String(repetitionsDefault), 10);

  if (mode === "live") {
    const missing = ["THIRD_PARTY_API_KEY", "AI_BASE_URL", "AI_MODEL"].filter(
      (key) => !process.env[key]?.trim(),
    );
    if (missing.length > 0) {
      console.error(`EVAL_BLOCKED: missing required configuration: ${missing.join(", ")}`);
      return 2;
    }

    if (flags.has("--require-privacy-approval")) {
      const approved = await promptPrivacyApproval();
      if (!approved) {
        console.error("EVAL_BLOCKED: privacy approval required for live eval");
        return 2;
      }
    }
  }

  if (flags.has("--candidate")) {
    const candidateModel = process.env.AI_MODEL_CANDIDATE?.trim();
    if (!candidateModel) {
      console.error("EVAL_BLOCKED: --candidate requires AI_MODEL_CANDIDATE");
      return 2;
    }
    process.env.AI_MODEL_CANDIDATE = candidateModel;
  }

  try {
    let analyzeStructured: import("./run-case").AnalyzeStructuredFn | undefined;
    if (mode === "live") {
      const { getServerEnv } = await import("../config/env");
      const { analyzeStructured: analyze } = await import("../ai/openai-compatible");
      const env = getServerEnv();
      const modelOverride = flags.has("--candidate")
        ? process.env.AI_MODEL_CANDIDATE
        : undefined;
      const evalEnv = modelOverride ? { ...env, AI_MODEL: modelOverride } : env;
      analyzeStructured = async (input) => {
        const result = await analyze({ env: evalEnv }, input);
        return {
          evaluatorAnalysis: result.evaluatorAnalysis,
          rawContent: result.rawContent,
        };
      };
    }

    const result = await runEvalSuite({
      manifestPath,
      datasetPath,
      mode,
      repetitions,
      resultsDir: path.join(repoRoot, "evals/results"),
      repoRoot,
      analyzeStructured,
    });

    console.log(`eval-suite: ${result.status} (${result.case_count} cases, ${result.mode} mode)`);
    console.log(`eval-suite: wrote ${result.latest_path}`);
    return result.status === "PASS" ? 0 : 1;
  } catch (error) {
    console.error(`eval-suite: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

async function promptPrivacyApproval(): Promise<boolean> {
  if (process.env.EVAL_PRIVACY_APPROVED === "1") {
    return true;
  }

  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolveAnswer) => {
    rl.question(
      "Confirm the configured endpoint privacy/retention terms are acceptable for synthetic eval data? [y/N] ",
      resolveAnswer,
    );
  });
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

const isDirectRun =
  process.argv[1] &&
  (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href ||
    import.meta.url === pathToFileURL(process.argv[1]).href);

if (isDirectRun) {
  runEvalSuiteCliWithRoot(process.argv.slice(2), path.resolve(process.cwd())).then((code) => {
    process.exit(code);
  });
}
