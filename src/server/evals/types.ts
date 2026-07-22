import { z } from "zod";

import { CategorySchema, PrioritySchema } from "../domain/report-analysis";

export const GoldLabelSchema = z.object({
  category: CategorySchema,
  severity: z.number().int().min(1).max(5),
  priority: PrioritySchema,
  is_critical: z.boolean(),
});

export type GoldLabel = z.infer<typeof GoldLabelSchema>;

export const EvalCaseTagSchema = z.enum([
  "injection",
  "safety_block",
  "grounding_trap",
  "conflict",
  "outage_fixture",
]);

export const EvalCaseSchema = z.object({
  case_id: z.string().min(1),
  locale: z.enum(["en", "vi"]),
  report_text: z.string().min(1),
  image_fixture: z.string().optional(),
  gold: GoldLabelSchema,
  tags: z.array(EvalCaseTagSchema).default([]),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;

export const ManifestLineageSchema = z.object({
  ai_base_url: z.string(),
  ai_model: z.string(),
  prompt_version: z.string(),
  routing_policy_version: z.string(),
});

export type ManifestLineage = z.infer<typeof ManifestLineageSchema>;

export const EvalManifestSchema = z.object({
  manifest_id: z.string().min(1),
  baseline: ManifestLineageSchema,
  candidate: ManifestLineageSchema,
  evaluator_config: z.string().min(1),
  dataset: z.string().min(1),
  thresholds_ref: z.string().min(1),
  parity_epsilon: z.number().min(0).max(1),
});

export type EvalManifest = z.infer<typeof EvalManifestSchema>;

export const EvaluatorThresholdsSchema = z.object({
  schema_pass_rate_min: z.number(),
  hallucination_pass_rate_min: z.number(),
  rubric_compliance_rate_min: z.number(),
  severity_consistency_min: z.number(),
  priority_consistency_min: z.number(),
  category_consistency_min: z.number(),
  mean_confidence_std_max: z.number(),
  false_critical_count_max: z.number(),
  missed_critical_count_max: z.number(),
  unsupported_occurred_injury_claim_count_max: z.number(),
  unsupported_cause_claim_count_max: z.number(),
});

export type EvaluatorThresholds = z.infer<typeof EvaluatorThresholdsSchema>;

export type CaseRunOutcome = {
  case_id: string;
  locale: "en" | "vi";
  gold: GoldLabel;
  tags: EvalCase["tags"];
  report_text: string;
  repetitions: Array<{
    analysis: import("../domain/report-analysis").ReportAnalysis | null;
    schema_valid: boolean;
    policy_ok: boolean;
    error_type?: string;
  }>;
};

export type AggregatedMetrics = {
  schema_pass_rate: number;
  hallucination_pass_rate: number;
  rubric_compliance_rate: number;
  severity_consistency: number;
  priority_consistency: number;
  category_consistency: number;
  mean_confidence_std: number;
  false_critical_count: number;
  missed_critical_count: number;
  unsupported_occurred_injury_claim_count: number;
  unsupported_cause_claim_count: number;
  failure_rate: number;
  macro_f1: number;
  under_triage_rate: number;
  locale_metrics: {
    en: LocaleMetricBundle;
    vi: LocaleMetricBundle;
  };
  locale_parity_delta: number;
  injection_policy_pass_rate: number;
};

export type LocaleMetricBundle = {
  macro_f1: number;
  severity_agreement: number;
  under_triage_rate: number;
  case_count: number;
};
