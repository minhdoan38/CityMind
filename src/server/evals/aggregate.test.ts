import { describe, expect, it } from "vitest";

import { aggregateOutcomes, loadEvaluatorThresholds, passesThresholds } from "./aggregate";
import type { AggregatedMetrics, CaseRunOutcome } from "./types";

function perfectMetrics(): AggregatedMetrics {
  return {
    schema_pass_rate: 1,
    hallucination_pass_rate: 1,
    rubric_compliance_rate: 1,
    severity_consistency: 1,
    priority_consistency: 1,
    category_consistency: 1,
    mean_confidence_std: 0,
    false_critical_count: 0,
    missed_critical_count: 0,
    unsupported_occurred_injury_claim_count: 0,
    unsupported_cause_claim_count: 0,
    failure_rate: 0,
    macro_f1: 1,
    under_triage_rate: 0,
    locale_metrics: {
      en: { macro_f1: 1, severity_agreement: 1, under_triage_rate: 0, case_count: 1 },
      vi: { macro_f1: 1, severity_agreement: 1, under_triage_rate: 0, case_count: 1 },
    },
    locale_parity_delta: 0,
    injection_policy_pass_rate: 1,
  };
}

const defaultThresholds = {
  schema_pass_rate_min: 0.99,
  hallucination_pass_rate_min: 0.95,
  rubric_compliance_rate_min: 0.9,
  severity_consistency_min: 0.9,
  priority_consistency_min: 0.9,
  category_consistency_min: 0.85,
  mean_confidence_std_max: 0.08,
  false_critical_count_max: 0,
  missed_critical_count_max: 0,
  unsupported_occurred_injury_claim_count_max: 0,
  unsupported_cause_claim_count_max: 0,
};

describe("passesThresholds", () => {
  it("passes when all evaluator thresholds are satisfied", () => {
    const result = passesThresholds(perfectMetrics(), defaultThresholds);
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails when a single threshold is violated", () => {
    const metrics = { ...perfectMetrics(), missed_critical_count: 1 };
    const result = passesThresholds(metrics, defaultThresholds);
    expect(result.pass).toBe(false);
    expect(result.failures).toContain("missed_critical_count");
  });

  it("enforces all 11 evaluator threshold keys", () => {
    const keys = [
      "schema_pass_rate",
      "hallucination_pass_rate",
      "rubric_compliance_rate",
      "severity_consistency",
      "priority_consistency",
      "category_consistency",
      "mean_confidence_std",
      "false_critical_count",
      "missed_critical_count",
      "unsupported_occurred_injury_claim_count",
      "unsupported_cause_claim_count",
    ] as const;

    for (const key of keys) {
      const metrics = perfectMetrics();
      if (key.endsWith("_count")) {
        (metrics as Record<string, number>)[key] = 1;
      } else if (key === "mean_confidence_std") {
        metrics.mean_confidence_std = 1;
      } else {
        (metrics as Record<string, number>)[key] = 0;
      }
      const result = passesThresholds(metrics, defaultThresholds);
      expect(result.pass).toBe(false);
      expect(result.failures).toContain(key);
    }
  });
});

describe("aggregateOutcomes", () => {
  it("aggregates locale metrics from case outcomes", () => {
    const outcomes: CaseRunOutcome[] = [
      {
        case_id: "en-1",
        locale: "en",
        gold: { category: "pothole", severity: 2, priority: "low", is_critical: false },
        tags: [],
        report_text: "Small pothole on a quiet street.",
        repetitions: [
          {
            analysis: {
              category: "pothole",
              severity: 2,
              confidence: 0.8,
              summary: "Small pothole on a quiet street.",
              recommendation: "Schedule routine repair.",
              priority: "low",
              estimated_impact: "Minor road surface issue.",
              evidence: ["Small pothole on a quiet street."],
              uncertainty: [],
            },
            schema_valid: true,
            policy_ok: true,
          },
        ],
      },
    ];

    const metrics = aggregateOutcomes(outcomes, { singleRepetition: true });
    expect(metrics.macro_f1).toBe(1);
    expect(metrics.locale_metrics.en.case_count).toBe(1);
  });
});

describe("loadEvaluatorThresholds", () => {
  it("loads thresholds from evaluator JSON", () => {
    const thresholds = loadEvaluatorThresholds(
      "prompt/citymind_ai_triage_structured_output_evaluator.json",
    );
    expect(thresholds.schema_pass_rate_min).toBe(0.99);
    expect(thresholds.missed_critical_count_max).toBe(0);
  });
});
