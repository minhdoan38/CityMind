import { describe, expect, it } from "vitest";

import {
  EvaluatorAnalysisSchema,
  EvaluatorCategorySchema,
} from "./evaluator-analysis";

const goldenAnalysis = {
  category: "flooding",
  observed_facts: ["Standing water blocks the crosswalk."],
  inferences: ["Pedestrian access may be impaired."],
  unknowns: ["Drainage cause is unknown."],
  severity: 4,
  severity_reason: "Standing water blocks the crosswalk.",
  priority: "high",
  priority_reason: "Material access disruption without confirmed imminent danger.",
  confidence: 0.78,
  recommended_action: "Inspect drainage and post temporary signage.",
  requires_human_review: true as const,
};

describe("EvaluatorCategorySchema", () => {
  it("accepts all 10 evaluator categories", () => {
    const categories = [
      "pothole",
      "flooding",
      "waste",
      "streetlight",
      "traffic_signal",
      "obstruction",
      "utility_hazard",
      "structural_damage",
      "graffiti",
      "other",
    ];
    for (const category of categories) {
      expect(EvaluatorCategorySchema.safeParse(category).success).toBe(true);
    }
  });

  it("rejects legacy-only categories outside evaluator enum", () => {
    expect(EvaluatorCategorySchema.safeParse("traffic").success).toBe(false);
  });
});

describe("EvaluatorAnalysisSchema", () => {
  it("accepts a valid 11-key payload", () => {
    expect(EvaluatorAnalysisSchema.safeParse(goldenAnalysis).success).toBe(true);
  });

  it("rejects requires_human_review false", () => {
    expect(
      EvaluatorAnalysisSchema.safeParse({
        ...goldenAnalysis,
        requires_human_review: false,
      }).success,
    ).toBe(false);
  });

  it("rejects extra keys", () => {
    expect(
      EvaluatorAnalysisSchema.safeParse({
        ...goldenAnalysis,
        summary: "legacy field",
      }).success,
    ).toBe(false);
  });
});
