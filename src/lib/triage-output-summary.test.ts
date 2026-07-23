import { describe, expect, it } from "vitest";

import { hasTriageOutputSummary, parseTriageOutputSummary } from "./triage-output-summary";

describe("parseTriageOutputSummary", () => {
  it("parses structured triage fields from raw JSON", () => {
    const summary = parseTriageOutputSummary(
      JSON.stringify({
        output_language: "vi-VN",
        category: "waste",
        matched_known_issue: true,
        observed_facts: ["Syringe on pavement."],
        inferences: ["Infection risk."],
      }),
    );

    expect(summary).toEqual({
      category: "waste",
      matched_known_issue: true,
      observed_facts: ["Syringe on pavement."],
      inferences: ["Infection risk."],
      output_language: "vi-VN",
    });
    expect(hasTriageOutputSummary(summary)).toBe(true);
  });

  it("returns null for invalid JSON", () => {
    expect(parseTriageOutputSummary("not json")).toBeNull();
  });
});
