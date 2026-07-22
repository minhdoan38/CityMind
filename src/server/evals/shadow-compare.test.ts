import { describe, expect, it } from "vitest";

import { compareShadowTriage } from "./shadow-compare";

describe("compareShadowTriage", () => {
  it("reports agreement when baseline and candidate match", () => {
    const result = compareShadowTriage(
      { category: "pothole", severity: 3, priority: "medium" },
      { category: "pothole", severity: 3, priority: "medium" },
    );
    expect(result.has_disagreement).toBe(false);
    expect(result.disagreement).toEqual({
      category: false,
      severity: false,
      priority: false,
    });
  });

  it("flags disagreement when any triage field differs", () => {
    const result = compareShadowTriage(
      { category: "pothole", severity: 3, priority: "medium" },
      { category: "flooding", severity: 3, priority: "medium" },
    );
    expect(result.has_disagreement).toBe(true);
    expect(result.disagreement.category).toBe(true);
    expect(result.disagreement.severity).toBe(false);
    expect(result.disagreement.priority).toBe(false);
  });

  it("detects severity and priority disagreements independently", () => {
    const severityOnly = compareShadowTriage(
      { category: "waste", severity: 2, priority: "low" },
      { category: "waste", severity: 4, priority: "low" },
    );
    expect(severityOnly.disagreement.severity).toBe(true);
    expect(severityOnly.has_disagreement).toBe(true);

    const priorityOnly = compareShadowTriage(
      { category: "waste", severity: 2, priority: "low" },
      { category: "waste", severity: 2, priority: "high" },
    );
    expect(priorityOnly.disagreement.priority).toBe(true);
    expect(priorityOnly.has_disagreement).toBe(true);
  });
});
