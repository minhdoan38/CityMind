import type { HanoiAnalysis } from "../domain/hanoi-analysis";

export type PolicyViolation = {
  code: string;
  message: string;
};

export type PolicyResult =
  | { ok: true }
  | { ok: false; violations: PolicyViolation[] };

function violation(code: string, message: string): PolicyViolation {
  return { code, message };
}

export function validateHanoiPolicy(analysis: HanoiAnalysis): PolicyResult {
  const violations: PolicyViolation[] = [];

  if (analysis.handling_type === 1 && analysis.severity !== "low") {
    violations.push(
      violation(
        "handling_type_1_requires_low_severity",
        "handling_type 1 (SELF_GUIDANCE) is only valid when severity is low.",
      ),
    );
  }

  if (
    analysis.handling_type === 3 &&
    (analysis.severity === "low" || analysis.severity === "medium")
  ) {
    violations.push(
      violation(
        "handling_type_3_requires_high_or_critical",
        "handling_type 3 (KEEP_AWAY) requires high or critical severity.",
      ),
    );
  }

  if (analysis.critical_alert && analysis.severity !== "critical") {
    violations.push(
      violation(
        "critical_alert_requires_critical_severity",
        "critical_alert may only be true when severity is critical.",
      ),
    );
  }

  if (!analysis.critical_alert && analysis.severity === "critical") {
    violations.push(
      violation(
        "critical_severity_requires_critical_alert",
        "critical severity requires critical_alert true.",
      ),
    );
  }

  if (analysis.category !== "other" && !analysis.matched_known_issue) {
    violations.push(
      violation(
        "matched_known_issue_must_be_true",
        "matched_known_issue must be true when category is not other.",
      ),
    );
  }

  if (analysis.category === "other" && analysis.matched_known_issue) {
    violations.push(
      violation(
        "other_category_requires_matched_known_issue_false",
        "matched_known_issue must be false when category is other.",
      ),
    );
  }

  if (analysis.guidance_code.startsWith("self_") && analysis.handling_type !== 1) {
    violations.push(
      violation(
        "self_guidance_code_requires_handling_type_1",
        "self_* guidance_code requires handling_type 1.",
      ),
    );
  }

  if (analysis.requires_human_review !== true) {
    violations.push(
      violation("requires_human_review_false", "requires_human_review must be true."),
    );
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }

  return { ok: true };
}
