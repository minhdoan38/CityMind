import { HANOI_SEVERITY_TO_INT } from "../domain/hanoi-analysis";

export type ShadowFieldDisagreement = {
  category: boolean;
  severity: boolean;
  priority: boolean;
  observed_facts?: boolean;
  severity_reason?: boolean;
};

export type ShadowComparison = {
  disagreement: ShadowFieldDisagreement;
  has_disagreement: boolean;
};

type ShadowComparable = {
  category: string;
  severity: number | "low" | "medium" | "high" | "critical";
  priority?: string;
  observed_facts: string[];
  severity_reason: string;
};

function normalizeSeverity(severity: ShadowComparable["severity"]): number {
  if (typeof severity === "number") {
    return severity;
  }
  return HANOI_SEVERITY_TO_INT[severity];
}

function shadowPriority(analysis: ShadowComparable): string {
  if (analysis.priority) {
    return analysis.priority;
  }
  if (typeof analysis.severity === "string") {
    return analysis.severity;
  }
  if (analysis.severity >= 5) return "critical";
  if (analysis.severity >= 4) return "high";
  if (analysis.severity >= 3) return "medium";
  return "low";
}

export function compareShadowTriage(
  baseline: ShadowComparable,
  candidate: ShadowComparable,
): ShadowComparison {
  const disagreement: ShadowFieldDisagreement = {
    category: baseline.category !== candidate.category,
    severity: normalizeSeverity(baseline.severity) !== normalizeSeverity(candidate.severity),
    priority: shadowPriority(baseline) !== shadowPriority(candidate),
    observed_facts:
      JSON.stringify(baseline.observed_facts) !== JSON.stringify(candidate.observed_facts),
    severity_reason: baseline.severity_reason !== candidate.severity_reason,
  };

  return {
    disagreement,
    has_disagreement: Object.values(disagreement).some(Boolean),
  };
}
