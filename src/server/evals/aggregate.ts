import { readFileSync } from "node:fs";
import path from "node:path";

import { ReportAnalysisSchema, type ReportAnalysis } from "../domain/report-analysis";
import { validateAnalysisPolicy } from "../validation/analysis-policy";

import {
  agreementRate,
  computeLocaleMetrics,
  countUnsupportedCauseClaim,
  countUnsupportedOccurredInjury,
  groundingPassRate,
  injectionPolicyPassRate,
  isFalseCritical,
  isUnderTriage,
  localeParityDelta,
  macroF1,
  meanConfidenceStd,
  repetitionConsistency,
} from "./metrics";
import type {
  AggregatedMetrics,
  CaseRunOutcome,
  EvaluatorThresholds,
} from "./types";

export function loadEvaluatorThresholds(evaluatorConfigPath: string): EvaluatorThresholds {
  const absolutePath = path.isAbsolute(evaluatorConfigPath)
    ? evaluatorConfigPath
    : path.resolve(process.cwd(), evaluatorConfigPath);
  const raw = JSON.parse(readFileSync(absolutePath, "utf8")) as { thresholds: EvaluatorThresholds };
  return raw.thresholds;
}

export function aggregateOutcomes(
  outcomes: CaseRunOutcome[],
  options: { singleRepetition: boolean } = { singleRepetition: false },
): AggregatedMetrics {
  const validReps = outcomes.flatMap((outcome) =>
    outcome.repetitions.map((rep, index) => ({
      outcome,
      rep,
      repIndex: index,
    })),
  );

  const schemaPasses = validReps.filter((item) => item.rep.schema_valid).length;
  const totalReps = validReps.length || 1;

  const policyInputs = validReps
    .filter((item) => item.rep.analysis)
    .map((item) => ({
      analysis: item.rep.analysis!,
      description: item.outcome.report_text,
    }));

  const primaryPairs = outcomes
    .map((outcome) => {
      const pred = outcome.repetitions[0]?.analysis;
      if (!pred) {
        return null;
      }
      return { gold: outcome.gold, pred };
    })
    .filter((pair): pair is { gold: CaseRunOutcome["gold"]; pred: ReportAnalysis } => pair !== null);

  let missedCritical = 0;
  let falseCritical = 0;
  let unsupportedInjury = 0;
  let unsupportedCause = 0;

  for (const { gold, pred } of primaryPairs) {
    if (isUnderTriage(gold, pred)) {
      missedCritical += 1;
    }
    if (isFalseCritical(gold, pred)) {
      falseCritical += 1;
    }
    unsupportedInjury += countUnsupportedOccurredInjury(pred);
    unsupportedCause += countUnsupportedCauseClaim(pred);
  }

  const failures = validReps.filter(
    (item) => !item.rep.schema_valid || !item.rep.analysis,
  ).length;

  const categoryConsistency =
    options.singleRepetition || outcomes.length === 0
      ? 1
      : averageConsistency(outcomes, (rep) => rep.analysis?.category ?? "");

  const severityConsistency =
    options.singleRepetition || outcomes.length === 0
      ? 1
      : averageConsistency(outcomes, (rep) => rep.analysis?.severity ?? 0);

  const priorityConsistency =
    options.singleRepetition || outcomes.length === 0
      ? 1
      : averageConsistency(outcomes, (rep) => rep.analysis?.priority ?? "");

  const confidences = validReps
    .map((item) => item.rep.analysis?.confidence)
    .filter((value): value is number => typeof value === "number");

  const enOutcomes = outcomes.filter((outcome) => outcome.locale === "en");
  const viOutcomes = outcomes.filter((outcome) => outcome.locale === "vi");
  const enMetrics = computeLocaleMetrics(enOutcomes);
  const viMetrics = computeLocaleMetrics(viOutcomes);

  const categoryPairs = primaryPairs.map(({ gold, pred }) => ({
    gold: gold.category,
    pred: pred.category,
  }));

  const underTriageCount = primaryPairs.filter(({ gold, pred }) =>
    isUnderTriage(gold, pred),
  ).length;

  return {
    schema_pass_rate: schemaPasses / totalReps,
    hallucination_pass_rate: groundingPassRate(policyInputs),
    rubric_compliance_rate: groundingPassRate(policyInputs),
    severity_consistency: severityConsistency,
    priority_consistency: priorityConsistency,
    category_consistency: categoryConsistency,
    mean_confidence_std: options.singleRepetition ? 0 : meanConfidenceStd(confidences),
    false_critical_count: falseCritical,
    missed_critical_count: missedCritical,
    unsupported_occurred_injury_claim_count: unsupportedInjury,
    unsupported_cause_claim_count: unsupportedCause,
    failure_rate: failures / totalReps,
    macro_f1: macroF1(categoryPairs),
    under_triage_rate:
      primaryPairs.length === 0 ? 0 : underTriageCount / primaryPairs.length,
    locale_metrics: {
      en: enMetrics,
      vi: viMetrics,
    },
    locale_parity_delta: localeParityDelta(enMetrics, viMetrics),
    injection_policy_pass_rate: injectionPolicyPassRate(outcomes),
  };
}

function averageConsistency<T extends string | number>(
  outcomes: CaseRunOutcome[],
  selector: (rep: CaseRunOutcome["repetitions"][number]) => T,
): number {
  if (outcomes.length === 0) {
    return 0;
  }
  const scores = outcomes.map((outcome) =>
    repetitionConsistency(outcome.repetitions.map((rep) => selector(rep))),
  );
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function passesThresholds(
  metrics: AggregatedMetrics,
  thresholds: EvaluatorThresholds,
): { pass: boolean; failures: string[] } {
  const failures: string[] = [];

  if (metrics.schema_pass_rate < thresholds.schema_pass_rate_min) {
    failures.push("schema_pass_rate");
  }
  if (metrics.hallucination_pass_rate < thresholds.hallucination_pass_rate_min) {
    failures.push("hallucination_pass_rate");
  }
  if (metrics.rubric_compliance_rate < thresholds.rubric_compliance_rate_min) {
    failures.push("rubric_compliance_rate");
  }
  if (metrics.severity_consistency < thresholds.severity_consistency_min) {
    failures.push("severity_consistency");
  }
  if (metrics.priority_consistency < thresholds.priority_consistency_min) {
    failures.push("priority_consistency");
  }
  if (metrics.category_consistency < thresholds.category_consistency_min) {
    failures.push("category_consistency");
  }
  if (metrics.mean_confidence_std > thresholds.mean_confidence_std_max) {
    failures.push("mean_confidence_std");
  }
  if (metrics.false_critical_count > thresholds.false_critical_count_max) {
    failures.push("false_critical_count");
  }
  if (metrics.missed_critical_count > thresholds.missed_critical_count_max) {
    failures.push("missed_critical_count");
  }
  if (
    metrics.unsupported_occurred_injury_claim_count >
    thresholds.unsupported_occurred_injury_claim_count_max
  ) {
    failures.push("unsupported_occurred_injury_claim_count");
  }
  if (metrics.unsupported_cause_claim_count > thresholds.unsupported_cause_claim_count_max) {
    failures.push("unsupported_cause_claim_count");
  }

  return { pass: failures.length === 0, failures };
}

export function validateReportAnalysis(value: unknown): {
  ok: boolean;
  analysis?: ReportAnalysis;
} {
  const parsed = ReportAnalysisSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false };
  }
  return { ok: true, analysis: parsed.data };
}

export function policyPasses(analysis: ReportAnalysis, description: string): boolean {
  return validateAnalysisPolicy(analysis, { description }).ok;
}

export function severityAgreementRate(
  pairs: Array<{ gold: number; pred: number }>,
): number {
  return agreementRate(pairs);
}
