import type { ReportAnalysis } from "../domain/report-analysis";

import { validateReportAnalysis } from "./aggregate";
import type { EvalCase } from "./types";

export type AnalyzeStructuredFn = (input: {
  description: string;
  image?: { bytes: Buffer; mimeType: string };
}) => Promise<{ analysis: ReportAnalysis; rawContent: string }>;

function goldToAnalysis(gold: EvalCase["gold"], reportText: string): ReportAnalysis {
  const severity = gold.severity;
  const priority = gold.priority;
  const category = gold.category;

  const groundedEvidence = reportText.trim().slice(0, 120);

  const analysis: ReportAnalysis = {
    category,
    severity,
    confidence: 0.86,
    summary: `Synthetic triage summary for ${category} incident.`,
    recommendation: "Officer review recommended before dispatch.",
    priority,
    estimated_impact: "Localized public-space impact reported by citizen.",
    evidence: [groundedEvidence],
    uncertainty: severity >= 4 ? [] : ["Impact extent not fully verified."],
  };

  if (severity === 5) {
    analysis.evidence = [groundedEvidence];
    analysis.uncertainty = [];
  }

  return analysis;
}

const MOCK_FIXTURE_OVERRIDES: Record<string, Partial<ReportAnalysis>> = {
  "inj-grounding-001": {
    category: "pothole",
    severity: 1,
    priority: "low",
    summary: "Minor sidewalk crack reported; cosmetic issue only.",
    recommendation: "Monitor during routine sidewalk inspection.",
    evidence: ["Small crack in sidewalk pavement."],
    uncertainty: [],
  },
};

export async function runCaseMock(
  evalCase: EvalCase,
): Promise<Array<{ analysis: ReportAnalysis | null; schema_valid: boolean; policy_ok: boolean }>> {
  const override = MOCK_FIXTURE_OVERRIDES[evalCase.case_id];
  const analysis = { ...goldToAnalysis(evalCase.gold, evalCase.report_text), ...override };
  const schema = validateReportAnalysis(analysis);

  return [
    {
      analysis: schema.ok ? schema.analysis! : null,
      schema_valid: schema.ok,
      policy_ok: schema.ok
        ? (await import("../validation/analysis-policy")).validateAnalysisPolicy(analysis, {
            description: evalCase.report_text,
          }).ok
        : false,
    },
  ];
}

export async function runCaseLive(
  evalCase: EvalCase,
  repetitions: number,
  analyzeStructured: AnalyzeStructuredFn,
): Promise<Array<{ analysis: ReportAnalysis | null; schema_valid: boolean; policy_ok: boolean; error_type?: string }>> {
  const results = [];

  for (let index = 0; index < repetitions; index += 1) {
    try {
      const result = await analyzeStructured({ description: evalCase.report_text });
      const schema = validateReportAnalysis(result.analysis);
      const policyOk = schema.ok
        ? (await import("../validation/analysis-policy")).validateAnalysisPolicy(
            result.analysis,
            { description: evalCase.report_text },
          ).ok
        : false;

      results.push({
        analysis: schema.ok ? result.analysis : null,
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
): Promise<Array<{ analysis: ReportAnalysis | null; schema_valid: boolean; policy_ok: boolean; error_type?: string }>> {
  if (options.mode === "mock") {
    return runCaseMock(evalCase);
  }

  if (!options.analyzeStructured) {
    throw new Error("analyzeStructured is required for live eval mode");
  }

  return runCaseLive(evalCase, options.repetitions, options.analyzeStructured);
}
