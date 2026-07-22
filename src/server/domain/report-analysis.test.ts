import { describe, expect, it } from "vitest";

import {
  CategorySchema,
  PrioritySchema,
  ReportAnalysisSchema,
  reportAnalysisJsonSchema,
} from "./report-analysis";

const goldenAnalysis = {
  category: "pothole",
  severity: 4,
  confidence: 0.82,
  summary: "Large pothole near a school entrance.",
  recommendation: "Inspect the road and secure the affected lane.",
  priority: "high",
  estimated_impact: "Safety risk for students and road users.",
  evidence: ["Citizen description identifies a large pothole."],
  uncertainty: ["Exact dimensions are not verified."],
};

describe("ReportAnalysisSchema", () => {
  it("accepts the sanitized legacy fixture shape", () => {
    const result = ReportAnalysisSchema.safeParse(goldenAnalysis);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(goldenAnalysis);
    }
  });

  it("rejects unrecognized fields (strict mode)", () => {
    const result = ReportAnalysisSchema.safeParse({
      ...goldenAnalysis,
      officer_decision: "approved",
    });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-range severity", () => {
    expect(ReportAnalysisSchema.safeParse({ ...goldenAnalysis, severity: 0 }).success).toBe(
      false,
    );
    expect(ReportAnalysisSchema.safeParse({ ...goldenAnalysis, severity: 6 }).success).toBe(
      false,
    );
  });

  it("rejects out-of-range confidence", () => {
    expect(ReportAnalysisSchema.safeParse({ ...goldenAnalysis, confidence: -0.1 }).success).toBe(
      false,
    );
    expect(ReportAnalysisSchema.safeParse({ ...goldenAnalysis, confidence: 1.1 }).success).toBe(
      false,
    );
  });

  it("rejects invalid category and priority enums", () => {
    expect(
      ReportAnalysisSchema.safeParse({ ...goldenAnalysis, category: "traffic" }).success,
    ).toBe(false);
    expect(
      ReportAnalysisSchema.safeParse({ ...goldenAnalysis, priority: "urgent" }).success,
    ).toBe(false);
  });

  it("rejects summary/recommendation length violations", () => {
    expect(
      ReportAnalysisSchema.safeParse({ ...goldenAnalysis, summary: "tiny" }).success,
    ).toBe(false);
    expect(
      ReportAnalysisSchema.safeParse({
        ...goldenAnalysis,
        recommendation: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });

  it("rejects evidence/uncertainty arrays over eight items", () => {
    const longList = Array.from({ length: 9 }, (_, i) => `item ${i}`);
    expect(
      ReportAnalysisSchema.safeParse({ ...goldenAnalysis, evidence: longList }).success,
    ).toBe(false);
    expect(
      ReportAnalysisSchema.safeParse({ ...goldenAnalysis, uncertainty: longList }).success,
    ).toBe(false);
  });

  it("exports JSON Schema with required legacy fields", () => {
    const schema = reportAnalysisJsonSchema as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "category",
        "severity",
        "confidence",
        "summary",
        "recommendation",
        "priority",
        "estimated_impact",
        "evidence",
        "uncertainty",
      ]),
    );
    expect(schema.properties?.category).toBeDefined();
    expect(schema.properties?.priority).toBeDefined();
  });
});

describe("enum schemas", () => {
  it("matches legacy category values", () => {
    const values = CategorySchema.options;
    expect(values).toEqual([
      "pothole",
      "flooding",
      "waste",
      "streetlight",
      "obstruction",
      "other",
    ]);
  });

  it("matches legacy priority values", () => {
    const values = PrioritySchema.options;
    expect(values).toEqual(["low", "medium", "high", "critical"]);
  });
});
