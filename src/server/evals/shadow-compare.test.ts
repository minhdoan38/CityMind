import { describe, expect, it } from "vitest";

import { compareShadowTriage } from "./shadow-compare";

describe("compareShadowTriage", () => {
  it("reports agreement when baseline and candidate match", () => {
    const sample = {
      category: "pothole" as const,
      severity: 3,
      priority: "medium" as const,
      observed_facts: ["Pothole near crossing."],
      severity_reason: "Pothole near crossing.",
    };
    const result = compareShadowTriage(sample, sample);
    expect(result.has_disagreement).toBe(false);
    expect(result.disagreement).toEqual({
      category: false,
      severity: false,
      priority: false,
      observed_facts: false,
      severity_reason: false,
    });
  });

  it("flags disagreement when any triage field differs", () => {
    const result = compareShadowTriage(
      {
        category: "pothole",
        severity: 3,
        priority: "medium",
        observed_facts: ["Pothole near crossing."],
        severity_reason: "Pothole near crossing.",
      },
      {
        category: "flooding",
        severity: 3,
        priority: "medium",
        observed_facts: ["Pothole near crossing."],
        severity_reason: "Pothole near crossing.",
      },
    );
    expect(result.has_disagreement).toBe(true);
    expect(result.disagreement.category).toBe(true);
    expect(result.disagreement.severity).toBe(false);
    expect(result.disagreement.priority).toBe(false);
  });

  it("detects severity and priority disagreements independently", () => {
    const base = {
      category: "waste" as const,
      observed_facts: ["Overflowing bin."],
      severity_reason: "Overflowing bin.",
    };
    const severityOnly = compareShadowTriage(
      { ...base, severity: 2, priority: "low" },
      { ...base, severity: 4, priority: "low" },
    );
    expect(severityOnly.disagreement.severity).toBe(true);
    expect(severityOnly.has_disagreement).toBe(true);

    const priorityOnly = compareShadowTriage(
      { ...base, severity: 2, priority: "low" },
      { ...base, severity: 2, priority: "high" },
    );
    expect(priorityOnly.disagreement.priority).toBe(true);
    expect(priorityOnly.has_disagreement).toBe(true);
  });
});
