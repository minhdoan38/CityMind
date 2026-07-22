import { describe, expect, it } from "vitest";

import type { ReportAnalysis } from "../domain/report-analysis";
import { validateAnalysisPolicy } from "./analysis-policy";

function validAnalysis(overrides: Partial<ReportAnalysis> = {}): ReportAnalysis {
  return {
    category: "pothole",
    severity: 4,
    confidence: 0.82,
    summary: "Large pothole near a school entrance.",
    recommendation: "Inspect the road and secure the affected lane.",
    priority: "high",
    estimated_impact: "Safety risk for students and road users.",
    evidence: ["Citizen description identifies a large pothole."],
    uncertainty: ["Exact dimensions are not verified."],
    ...overrides,
  };
}

describe("validateAnalysisPolicy", () => {
  it("accepts a well-formed advisory analysis", () => {
    const result = validateAnalysisPolicy(validAnalysis());
    expect(result.ok).toBe(true);
  });

  it("rejects empty evidence or uncertainty strings", () => {
    const evidence = validateAnalysisPolicy(validAnalysis({ evidence: [""] }));
    expect(evidence.ok).toBe(false);
    if (!evidence.ok) {
      expect(evidence.violations.some((v) => v.code === "empty_evidence_item")).toBe(true);
    }

    const uncertainty = validateAnalysisPolicy(validAnalysis({ uncertainty: ["  "] }));
    expect(uncertainty.ok).toBe(false);
    if (!uncertainty.ok) {
      expect(uncertainty.violations.some((v) => v.code === "empty_uncertainty_item")).toBe(true);
    }
  });

  it("requires evidence and uncertainty to remain separated", () => {
    const overlap = "Same statement in both lists.";
    const result = validateAnalysisPolicy(
      validAnalysis({ evidence: [overlap], uncertainty: [overlap] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.code === "evidence_uncertainty_overlap")).toBe(true);
    }
  });

  it("requires uncertainty when confidence is very low", () => {
    const result = validateAnalysisPolicy(
      validAnalysis({ confidence: 0.2, uncertainty: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.code === "low_confidence_missing_uncertainty")).toBe(
        true,
      );
    }
  });

  it("rejects critical priority without severity 5", () => {
    const result = validateAnalysisPolicy(
      validAnalysis({ priority: "critical", severity: 4 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.code === "critical_requires_severity_5")).toBe(true);
    }
  });

  it("rejects severity 5 without immediate-danger evidence", () => {
    const result = validateAnalysisPolicy(
      validAnalysis({
        priority: "critical",
        severity: 5,
        evidence: ["Large pothole near a school entrance."],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.code === "severity_5_requires_danger_evidence")).toBe(
        true,
      );
    }
  });

  it("rejects conflicting signals with confidence above 0.64", () => {
    const result = validateAnalysisPolicy(
      validAnalysis({
        confidence: 0.9,
        uncertainty: ["Sources conflict on whether the lane is blocked."],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.code === "conflict_confidence_cap")).toBe(true);
    }
  });

  it("rejects critical priority with cosmetic severity", () => {
    const result = validateAnalysisPolicy(
      validAnalysis({ priority: "critical", severity: 1 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.code === "priority_severity_mismatch")).toBe(true);
    }
  });

  it("rejects autonomous final-authority wording", () => {
    const result = validateAnalysisPolicy(
      validAnalysis({
        recommendation: "This is the final decision and will be executed autonomously.",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.code === "autonomous_authority_language")).toBe(true);
    }
  });

  it("is deterministic and does not mutate or override officer decisions", () => {
    const analysis = validAnalysis();
    const first = validateAnalysisPolicy(analysis);
    const second = validateAnalysisPolicy(analysis);
    expect(first).toEqual(second);
    expect(analysis.priority).toBe("high");
  });
});
