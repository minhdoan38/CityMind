import { describe, expect, it } from "vitest";

import {
  buildSlaHistogram,
  buildSlaSummary,
  publicTopCategories,
  validateAnalyticsRange,
} from "@/server/repositories/analytics";

describe("validateAnalyticsRange", () => {
  it("rejects inverted ranges", () => {
    expect(() => validateAnalyticsRange("2026-07-02", "2026-07-01")).toThrow(
      "Invalid date range",
    );
  });

  it("rejects spans over 366 days", () => {
    expect(() => validateAnalyticsRange("2025-01-01", "2026-12-31")).toThrow(
      "366 days",
    );
  });

  it("accepts valid ranges", () => {
    expect(() =>
      validateAnalyticsRange("2026-06-01", "2026-06-30"),
    ).not.toThrow();
  });
});

describe("buildSlaSummary", () => {
  it("returns empty summary for no closes", () => {
    expect(buildSlaSummary([])).toEqual({
      closed_count: 0,
      median_days: null,
      avg_days: null,
      histogram: [],
    });
  });

  it("computes median, average, and histogram buckets", () => {
    const summary = buildSlaSummary([1, 3, 7, 14, 20]);
    expect(summary.closed_count).toBe(5);
    expect(summary.median_days).toBe(7);
    expect(summary.avg_days).toBe(9);
    expect(buildSlaHistogram([1, 3, 7, 14, 20])).toEqual([
      { label: "0-1", count: 1 },
      { label: "2-3", count: 1 },
      { label: "4-7", count: 1 },
      { label: "8-14", count: 1 },
      { label: "15+", count: 1 },
    ]);
  });
});

describe("publicTopCategories", () => {
  it("filters k>=3 and caps at two categories", () => {
    const top = publicTopCategories([
      { category: "pothole", report_count: 10 },
      { category: "lighting", report_count: 5 },
      { category: "graffiti", report_count: 2 },
      { category: "noise", report_count: 4 },
    ]);
    expect(top).toEqual([
      { category: "pothole", count: 10 },
      { category: "lighting", count: 5 },
    ]);
  });
});
