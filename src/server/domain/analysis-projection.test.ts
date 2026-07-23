import { describe, expect, it } from "vitest";

import {
  projectEvaluatorAnalysis,
  projectLegacyCitizenFields,
  projectToLegacyReportAnalysis,
} from "./analysis-projection";

describe("analysis-projection", () => {
  it("reads post-migration 11-key rows directly", () => {
    const analysis = projectEvaluatorAnalysis({
      category: "traffic_signal",
      observed_facts: ["Traffic signal is dark at Main St."],
      inferences: ["Intersection control may be impaired."],
      unknowns: ["Power outage cause unknown."],
      severity: 4,
      severity_reason: "Traffic signal is dark at Main St.",
      priority: "high",
      priority_reason: "Intersection safety risk without active collision.",
      confidence: 0.8,
      recommended_action: "Dispatch traffic control inspection.",
      requires_human_review: true,
    });

    expect(analysis.category).toBe("traffic_signal");
    expect(analysis.observed_facts).toHaveLength(1);
    expect(analysis.recommended_action).toContain("inspection");
  });

  it("maps pre-migration legacy-only rows", () => {
    const analysis = projectEvaluatorAnalysis({
      category: "pothole",
      severity: 2,
      confidence: 0.7,
      summary: "Small pothole on Oak Avenue.",
      recommendation: "Schedule routine patching.",
      priority: "low",
      estimated_impact: "Minor localized inconvenience.",
      evidence: ["Pothole visible near curb."],
      uncertainty: ["Depth not measured."],
    });

    expect(analysis.observed_facts).toContain("Pothole visible near curb.");
    expect(analysis.severity_reason).toBe("Small pothole on Oak Avenue.");
    expect(analysis.recommended_action).toBe("Schedule routine patching.");
  });

  it("dual-writes legacy citizen fields from evaluator analysis", () => {
    const evaluator = projectEvaluatorAnalysis({
      category: "flooding",
      observed_facts: ["Water covers the sidewalk."],
      inferences: [],
      unknowns: [],
      severity: 3,
      severity_reason: "Water covers the sidewalk.",
      priority: "medium",
      priority_reason: "Localized access disruption.",
      confidence: 0.75,
      recommended_action: "Inspect drainage grates.",
      requires_human_review: true,
    });

    const citizen = projectLegacyCitizenFields(evaluator);
    expect(citizen.summary).toBe("Water covers the sidewalk.");
    expect(citizen.recommendation).toBe("Inspect drainage grates.");

    const legacy = projectToLegacyReportAnalysis(evaluator);
    expect(legacy.category).toBe("flooding");
    expect(legacy.evidence).toEqual(["Water covers the sidewalk."]);
    expect(legacy.uncertainty).toEqual([]);
  });

  it("maps evaluator-only categories to other for legacy consumers", () => {
    const evaluator = projectEvaluatorAnalysis({
      category: "utility_hazard",
      observed_facts: ["Exposed cable near playground."],
      inferences: [],
      unknowns: [],
      severity: 4,
      severity_reason: "Exposed cable near playground.",
      priority: "high",
      priority_reason: "Possible safety hazard near children.",
      confidence: 0.7,
      recommended_action: "Isolate area pending inspection.",
      requires_human_review: true,
    });

    const legacy = projectToLegacyReportAnalysis(evaluator);
    expect(legacy.category).toBe("other");
  });
});
