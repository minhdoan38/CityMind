import type { ReportAnalysis } from "../domain/report-analysis";

export type ShadowFieldDisagreement = {
  category: boolean;
  severity: boolean;
  priority: boolean;
};

export type ShadowComparison = {
  disagreement: ShadowFieldDisagreement;
  has_disagreement: boolean;
};

export function compareShadowTriage(
  baseline: Pick<ReportAnalysis, "category" | "severity" | "priority">,
  candidate: Pick<ReportAnalysis, "category" | "severity" | "priority">,
): ShadowComparison {
  const disagreement: ShadowFieldDisagreement = {
    category: baseline.category !== candidate.category,
    severity: baseline.severity !== candidate.severity,
    priority: baseline.priority !== candidate.priority,
  };

  return {
    disagreement,
    has_disagreement:
      disagreement.category || disagreement.severity || disagreement.priority,
  };
}
