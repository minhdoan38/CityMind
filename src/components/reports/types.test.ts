import { describe, expect, it } from "vitest";

import { countActiveFilters, hasActiveFilters } from "./types";

describe("countActiveFilters", () => {
  it("returns zero when no filters are set", () => {
    expect(countActiveFilters({})).toBe(0);
    expect(hasActiveFilters({})).toBe(false);
  });

  it("counts each logical filter dimension once", () => {
    expect(
      countActiveFilters({
        triage_status: "pending,processing",
        routing_destination: "self_help",
        status: "new",
        min_severity: "4",
        created_after: "2026-01-01",
      }),
    ).toBe(5);
  });

  it("ignores routing all/default state", () => {
    expect(countActiveFilters({ routing_destination: "all" })).toBe(0);
  });
});
