import { describe, expect, it } from "vitest";

import type { EvaluatorAnalysis } from "@/server/domain/evaluator-analysis";
import { validateEvaluatorPolicy } from "./evaluator-policy";

function validAnalysis(overrides: Partial<EvaluatorAnalysis> = {}): EvaluatorAnalysis {
  return {
    category: "flooding",
    observed_facts: [
      "Citizen reports active flooding with imminent danger near the school crossing.",
    ],
    inferences: ["Pedestrian access may be impaired."],
    unknowns: ["Exact depth is not verified."],
    severity: 5,
    severity_reason:
      "Citizen reports active flooding with imminent danger near the school crossing.",
    priority: "critical",
    priority_reason:
      "Active flooding with imminent danger near the school crossing requires urgent response.",
    confidence: 0.82,
    recommended_action: "Inspect the road and secure the affected lane.",
    requires_human_review: true,
    ...overrides,
  };
}

describe("validateEvaluatorPolicy", () => {
  it("accepts critical priority when severity is 5 with danger evidence", () => {
    const result = validateEvaluatorPolicy(validAnalysis());
    expect(result.ok).toBe(true);
  });

  it("rejects critical priority when severity is below 5", () => {
    const result = validateEvaluatorPolicy(
      validAnalysis({
        priority: "critical",
        severity: 4,
        severity_reason: "Standing water blocks the crosswalk hazard area.",
        priority_reason: "Standing water blocks the crosswalk hazard area.",
        observed_facts: ["Standing water blocks the crosswalk hazard area."],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.code === "critical_requires_severity_5")).toBe(
        true,
      );
    }
  });

  it("rejects severity 5 without immediate-danger evidence in observed_facts", () => {
    const result = validateEvaluatorPolicy(
      validAnalysis({
        severity: 5,
        priority: "high",
        observed_facts: ["Large pothole near the curb."],
        severity_reason: "Large pothole near the curb.",
        priority_reason: "Large pothole near the curb may affect vehicles.",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.violations.some((v) => v.code === "severity_5_requires_danger_evidence"),
      ).toBe(true);
    }
  });

  it("rejects severity 4 without supported hazard evidence", () => {
    const result = validateEvaluatorPolicy(
      validAnalysis({
        severity: 4,
        priority: "high",
        observed_facts: ["Trash bag on sidewalk."],
        severity_reason: "Trash bag on sidewalk.",
        priority_reason: "Trash bag on sidewalk may inconvenience pedestrians.",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.violations.some((v) => v.code === "severity_4_requires_supported_hazard"),
      ).toBe(true);
    }
  });
});
