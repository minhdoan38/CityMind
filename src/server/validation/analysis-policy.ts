import type { ReportAnalysis } from "../domain/report-analysis";

export type PolicyViolation = {
  code: string;
  message: string;
};

export type PolicyResult =
  | { ok: true }
  | { ok: false; violations: PolicyViolation[] };

const AUTONOMOUS_AUTHORITY_PATTERNS = [
  /\bfinal decision\b/i,
  /\bautonomous(?:ly)?\b/i,
  /\bwithout officer\b/i,
  /\bno human review\b/i,
];

const MIN_SEVERITY_BY_PRIORITY: Record<ReportAnalysis["priority"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const LOW_CONFIDENCE_THRESHOLD = 0.3;
const CONFLICT_CONFIDENCE_CAP = 0.64;

const IMMEDIATE_DANGER_PATTERNS = [
  /\bimmediate danger\b/i,
  /\bimminent\b/i,
  /\bactive fire\b/i,
  /\blive electrical\b/i,
  /\bentrapment\b/i,
  /\bcollision risk\b/i,
  /\bactive flooding\b/i,
  /\bcollapse\b/i,
  /\blife[- ]safety\b/i,
];

function hasImmediateDangerEvidence(evidence: string[]): boolean {
  return evidence.some((item) =>
    IMMEDIATE_DANGER_PATTERNS.some((pattern) => pattern.test(item)),
  );
}

function hasConflictingSignals(analysis: ReportAnalysis): boolean {
  const uncertaintyMentionsConflict = analysis.uncertainty.some((item) =>
    /\bconflict\b|\bcontradict\b|\bunclear\b|\bambiguous\b|\bdisagree\b/i.test(item),
  );
  const lowConfidence = analysis.confidence <= CONFLICT_CONFIDENCE_CAP;
  return uncertaintyMentionsConflict || (analysis.uncertainty.length > 0 && lowConfidence);
}

function hasUnsupportedEvidenceClaim(
  description: string,
  evidence: string[],
): boolean {
  const normalizedDescription = description.trim().toLowerCase();
  if (!normalizedDescription) {
    return evidence.some((item) => item.trim().length > 0);
  }
  return evidence.some((item) => {
    const normalized = item.trim().toLowerCase();
    if (!normalized) return false;
    const words = normalized.split(/\s+/).filter((word) => word.length > 4);
    if (words.length === 0) return false;
    const grounded = words.some((word) => normalizedDescription.includes(word));
    return !grounded;
  });
}

function violation(code: string, message: string): PolicyViolation {
  return { code, message };
}

export function validateAnalysisPolicy(
  analysis: ReportAnalysis,
  options: { description?: string } = {},
): PolicyResult {
  const violations: PolicyViolation[] = [];

  for (const item of analysis.evidence) {
    if (!item.trim()) {
      violations.push(violation("empty_evidence_item", "Evidence items must be non-empty."));
    }
  }

  for (const item of analysis.uncertainty) {
    if (!item.trim()) {
      violations.push(
        violation("empty_uncertainty_item", "Uncertainty items must be non-empty."),
      );
    }
  }

  const normalizedEvidence = new Set(
    analysis.evidence.map((item) => item.trim().toLowerCase()).filter(Boolean),
  );
  for (const item of analysis.uncertainty) {
    const normalized = item.trim().toLowerCase();
    if (normalized && normalizedEvidence.has(normalized)) {
      violations.push(
        violation(
          "evidence_uncertainty_overlap",
          "Evidence and uncertainty must remain separated.",
        ),
      );
      break;
    }
  }

  if (analysis.confidence < LOW_CONFIDENCE_THRESHOLD && analysis.uncertainty.length === 0) {
    violations.push(
      violation(
        "low_confidence_missing_uncertainty",
        "Low-confidence analyses must document uncertainty.",
      ),
    );
  }

  if (analysis.priority === "critical" && analysis.severity !== 5) {
    violations.push(
      violation(
        "critical_requires_severity_5",
        "Critical priority requires severity 5 alignment.",
      ),
    );
  }

  if (analysis.severity === 5 && !hasImmediateDangerEvidence(analysis.evidence)) {
    violations.push(
      violation(
        "severity_5_requires_danger_evidence",
        "Severity 5 requires immediate-danger evidence in evidence items.",
      ),
    );
  }

  if (hasConflictingSignals(analysis) && analysis.confidence > CONFLICT_CONFIDENCE_CAP) {
    violations.push(
      violation(
        "conflict_confidence_cap",
        "Conflicting signals require confidence at or below 0.64.",
      ),
    );
  }

  if (
    options.description !== undefined &&
    hasUnsupportedEvidenceClaim(options.description, analysis.evidence)
  ) {
    violations.push(
      violation(
        "unsupported_evidence_claim",
        "Evidence items must be grounded in the citizen description.",
      ),
    );
  }

  if (analysis.severity < MIN_SEVERITY_BY_PRIORITY[analysis.priority]) {
    violations.push(
      violation(
        "priority_severity_mismatch",
        "Priority must align with the stated severity scale.",
      ),
    );
  }

  const advisoryText = `${analysis.summary} ${analysis.recommendation}`;
  if (AUTONOMOUS_AUTHORITY_PATTERNS.some((pattern) => pattern.test(advisoryText))) {
    violations.push(
      violation(
        "autonomous_authority_language",
        "Advisory output must not claim autonomous final authority.",
      ),
    );
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }

  return { ok: true };
}
