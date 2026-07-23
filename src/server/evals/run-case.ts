import type { EvaluatorAnalysis } from "../domain/evaluator-analysis";
import type { AnalysisInput } from "../ai/provider";
import { validateEvaluatorPolicy } from "../validation/evaluator-policy";

import { validateEvaluatorAnalysis } from "./aggregate";
import type { EvalCase } from "./types";

export type AnalyzeStructuredFn = (
  input: AnalysisInput,
) => Promise<{ evaluatorAnalysis: EvaluatorAnalysis; rawContent?: string }>;

function goldToEvaluatorAnalysis(
  gold: EvalCase["gold"],
  reportText: string,
  tags: EvalCase["tags"] = [],
): EvaluatorAnalysis {
  const text = reportText.trim();
  const isInjection = tags.includes("injection");
  const primaryFact = isInjection
    ? `Citizen submitted a ${gold.category} report for review.`
    : text.slice(0, 200) || "Citizen reported an incident.";
  const observed_facts = [primaryFact];

  const hazardMatch = text.match(/\b(hazard|danger|unsafe|risk|exposed)\b/i);
  if (hazardMatch) {
    observed_facts.push(hazardMatch[0]);
  }

  const dangerMatch = text.match(
    /\b(immediate danger|imminent|active fire|live electrical|entrapment|collision risk|active flooding|collapse|life[- ]safety)\b/i,
  );
  if (dangerMatch) {
    observed_facts.push(dangerMatch[0]);
  }

  const severity = gold.severity;
  const priority = gold.priority;
  const severity_reason = primaryFact;
  const priority_reason = primaryFact;

  return {
    category: gold.category,
    observed_facts: [...new Set(observed_facts)],
    inferences: [`Incident may affect local ${gold.category} infrastructure.`],
    unknowns: severity >= 4 ? [] : ["Impact extent not fully verified."],
    severity,
    severity_reason,
    priority,
    priority_reason,
    confidence: 0.86,
    recommended_action: "Officer review recommended before dispatch.",
    requires_human_review: true,
  };
}

const MOCK_FIXTURE_OVERRIDES: Record<string, Partial<EvaluatorAnalysis>> = {
  "inj-grounding-001": {
    category: "pothole",
    severity: 1,
    priority: "low",
    observed_facts: ["Small crack in sidewalk pavement."],
    severity_reason: "Small crack in sidewalk pavement.",
    priority_reason: "Small crack in sidewalk pavement. Severity 1 supports low priority.",
    recommended_action: "Monitor during routine sidewalk inspection.",
    unknowns: [],
  },
};

export async function runCaseMock(
  evalCase: EvalCase,
): Promise<
  Array<{ analysis: EvaluatorAnalysis | null; schema_valid: boolean; policy_ok: boolean }>
> {
  const override = MOCK_FIXTURE_OVERRIDES[evalCase.case_id];
  const analysis = {
    ...goldToEvaluatorAnalysis(evalCase.gold, evalCase.report_text, evalCase.tags),
    ...override,
  };
  const schema = validateEvaluatorAnalysis(analysis);
  const policyOk = schema.ok
    ? validateEvaluatorPolicy(analysis, { description: evalCase.report_text }).ok
    : false;

  return [
    {
      analysis: schema.ok ? schema.analysis! : null,
      schema_valid: schema.ok,
      policy_ok: policyOk,
    },
  ];
}

export async function runCaseLive(
  evalCase: EvalCase,
  repetitions: number,
  analyzeStructured: AnalyzeStructuredFn,
): Promise<
  Array<{
    analysis: EvaluatorAnalysis | null;
    schema_valid: boolean;
    policy_ok: boolean;
    error_type?: string;
  }>
> {
  const results = [];

  for (let index = 0; index < repetitions; index += 1) {
    try {
      const result = await analyzeStructured({ description: evalCase.report_text });
      const schema = validateEvaluatorAnalysis(result.evaluatorAnalysis);
      const policyOk = schema.ok
        ? validateEvaluatorPolicy(result.evaluatorAnalysis, {
            description: evalCase.report_text,
          }).ok
        : false;

      results.push({
        analysis: schema.ok ? result.evaluatorAnalysis : null,
        schema_valid: schema.ok,
        policy_ok: policyOk,
      });
    } catch (error) {
      results.push({
        analysis: null,
        schema_valid: false,
        policy_ok: false,
        error_type: error instanceof Error ? error.name : "unknown_error",
      });
    }
  }

  return results;
}

export async function runCase(
  evalCase: EvalCase,
  options: {
    mode: "mock" | "live";
    repetitions: number;
    analyzeStructured?: AnalyzeStructuredFn;
  },
): Promise<
  Array<{
    analysis: EvaluatorAnalysis | null;
    schema_valid: boolean;
    policy_ok: boolean;
    error_type?: string;
  }>
> {
  if (options.mode === "mock") {
    return runCaseMock(evalCase);
  }

  if (!options.analyzeStructured) {
    throw new Error("analyzeStructured is required for live eval mode");
  }

  return runCaseLive(evalCase, options.repetitions, options.analyzeStructured);
}
