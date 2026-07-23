import { describe, expect, it } from "vitest";

import {
  clearActiveFilterChip,
  listActiveFilterChips,
} from "./active-filter-chips";

describe("listActiveFilterChips", () => {
  it("returns chips in scan-friendly order", () => {
    const chips = listActiveFilterChips({
      triage_status: "manual_review,failed",
      min_severity: "4",
      category: "pothole",
    });

    expect(chips.map((chip) => chip.type)).toEqual([
      "triage",
      "severity",
      "category",
    ]);
  });

  it("clears a single filter dimension", () => {
    const params = new URLSearchParams({
      triage_status: "manual_review,failed",
      min_severity: "4",
      category: "pothole",
    });
    const severityChip = listActiveFilterChips({
      triage_status: "manual_review,failed",
      min_severity: "4",
      category: "pothole",
    }).find((chip) => chip.type === "severity");

    expect(severityChip).toBeDefined();
    clearActiveFilterChip(params, severityChip!);

    expect(params.get("min_severity")).toBeNull();
    expect(params.get("max_severity")).toBeNull();
    expect(params.get("triage_status")).toBe("manual_review,failed");
    expect(params.get("category")).toBe("pothole");
  });
});
