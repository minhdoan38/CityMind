import {
  CategorySchema,
  type ReportAnalysis,
} from "./report-analysis";
import {
  EvaluatorAnalysisSchema,
  type EvaluatorAnalysis,
} from "./evaluator-analysis";
import {
  HANOI_SEVERITY_TO_INT,
  type HanoiAnalysis,
} from "./hanoi-analysis";

export type ReportAnalysisRow = {
  category?: string | null;
  severity?: number | null;
  confidence?: number | null;
  summary?: string | null;
  recommendation?: string | null;
  priority?: string | null;
  estimated_impact?: string | null;
  evidence?: string[] | null;
  uncertainty?: string[] | null;
  observed_facts?: string[] | null;
  inferences?: string[] | null;
  unknowns?: string[] | null;
  severity_reason?: string | null;
  priority_reason?: string | null;
  recommended_action?: string | null;
  requires_human_review?: boolean | null;
};

function hasEvaluatorColumns(row: ReportAnalysisRow): boolean {
  if (row.severity_reason?.trim()) {
    return true;
  }
  return Array.isArray(row.observed_facts) && row.observed_facts.length > 0;
}

function toLegacyCategory(category: string): ReportAnalysis["category"] {
  const parsed = CategorySchema.safeParse(category);
  return parsed.success ? parsed.data : "other";
}

function legacyRowToEvaluator(row: ReportAnalysisRow): EvaluatorAnalysis {
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  const uncertainty = Array.isArray(row.uncertainty) ? row.uncertainty : [];
  const category = toLegacyCategory(row.category ?? "other");

  return EvaluatorAnalysisSchema.parse({
    category,
    observed_facts: evidence.length > 0 ? evidence : [row.summary ?? "Report submitted."],
    inferences: [],
    unknowns: uncertainty,
    severity: row.severity ?? 1,
    severity_reason: row.summary ?? "Legacy summary unavailable.",
    priority: row.priority ?? "low",
    priority_reason: row.estimated_impact ?? "Legacy impact unavailable.",
    confidence: row.confidence ?? 0.5,
    recommended_action: row.recommendation ?? "Await officer review.",
    requires_human_review: true,
  });
}

export function projectEvaluatorAnalysis(row: ReportAnalysisRow): EvaluatorAnalysis {
  if (hasEvaluatorColumns(row)) {
    return EvaluatorAnalysisSchema.parse({
      category: row.category,
      observed_facts: row.observed_facts ?? [],
      inferences: row.inferences ?? [],
      unknowns: row.unknowns ?? [],
      severity: row.severity,
      severity_reason: row.severity_reason,
      priority: row.priority,
      priority_reason: row.priority_reason,
      confidence: row.confidence,
      recommended_action: row.recommended_action,
      requires_human_review: true,
    });
  }

  return legacyRowToEvaluator(row);
}

export function projectLegacyCitizenFields(
  analysis: EvaluatorAnalysis,
): Pick<ReportAnalysis, "summary" | "recommendation"> {
  return {
    summary:
      analysis.severity_reason ||
      analysis.observed_facts.join(" ") ||
      "Report under review.",
    recommendation: analysis.recommended_action,
  };
}

export function projectToLegacyReportAnalysis(
  analysis: EvaluatorAnalysis,
): ReportAnalysis {
  const citizen = projectLegacyCitizenFields(analysis);
  return {
    category: toLegacyCategory(analysis.category),
    severity: analysis.severity,
    confidence: analysis.confidence,
    summary: citizen.summary,
    recommendation: citizen.recommendation,
    priority: analysis.priority,
    estimated_impact: analysis.priority_reason,
    evidence: [...analysis.observed_facts],
    uncertainty: [...analysis.unknowns],
  };
}

export function projectHanoiToLegacyRow(analysis: HanoiAnalysis): Record<string, unknown> {
  const severityInt = HANOI_SEVERITY_TO_INT[analysis.severity];
  const priority =
    analysis.severity === "critical"
      ? "critical"
      : analysis.severity === "high"
        ? "high"
        : analysis.severity === "medium"
          ? "medium"
          : "low";

  return {
    category: analysis.category,
    matched_known_issue: analysis.matched_known_issue,
    observed_facts: analysis.observed_facts,
    inferences: analysis.inferences,
    unknowns: analysis.unknowns,
    severity: severityInt,
    severity_label: analysis.severity,
    severity_reason: analysis.severity_reason,
    confidence: analysis.confidence,
    handling_type: analysis.handling_type,
    handling_label: analysis.handling_label,
    allowed_actions: analysis.allowed_actions,
    prohibited_actions: analysis.prohibited_actions,
    recommended_action: analysis.recommended_action,
    guidance_code: analysis.guidance_code,
    critical_alert: analysis.critical_alert,
    requires_human_review: true,
    priority,
    priority_reason: `${analysis.handling_label} — Hanoi ${analysis.severity} severity`,
    summary: analysis.severity_reason,
    recommendation: analysis.recommended_action,
    estimated_impact: `${analysis.handling_label} — Hanoi ${analysis.severity} severity`,
    evidence: analysis.observed_facts,
    uncertainty: analysis.unknowns,
  };
}

export function projectToLegacyReportAnalysisFromHanoi(
  analysis: HanoiAnalysis,
): ReportAnalysis {
  const citizen = projectLegacyCitizenFieldsFromHanoi(analysis);
  return {
    category: toLegacyCategory(analysis.category),
    severity: HANOI_SEVERITY_TO_INT[analysis.severity],
    confidence: analysis.confidence,
    summary: citizen.summary,
    recommendation: citizen.recommendation,
    priority:
      analysis.severity === "critical"
        ? "critical"
        : analysis.severity === "high"
          ? "high"
          : analysis.severity === "medium"
            ? "medium"
            : "low",
    estimated_impact: `${analysis.handling_label} — Hanoi ${analysis.severity} severity`,
    evidence: [...analysis.observed_facts],
    uncertainty: [...analysis.unknowns],
  };
}

export function projectLegacyCitizenFieldsFromHanoi(
  analysis: HanoiAnalysis,
): Pick<ReportAnalysis, "summary" | "recommendation"> {
  return {
    summary:
      analysis.severity_reason ||
      analysis.observed_facts.join(" ") ||
      "Report under review.",
    recommendation: analysis.recommended_action,
  };
}

export function projectHanoiPayloadForRpc(analysis: HanoiAnalysis): Record<string, unknown> {
  return projectHanoiToLegacyRow(analysis);
}

