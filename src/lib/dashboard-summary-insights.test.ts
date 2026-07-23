import { describe, expect, it } from "vitest";

import {
  buildTopCategories,
  buildVolume7d,
  buildWorkloadByStatus,
} from "./dashboard-summary-insights";

describe("dashboard-summary-insights", () => {
  const now = Date.parse("2026-07-23T12:00:00.000Z");

  const rows = [
    {
      created_at: "2026-07-23T08:00:00.000Z",
      current_status: "new",
      category: "pothole",
    },
    {
      created_at: "2026-07-23T09:00:00.000Z",
      current_status: "reviewing",
      category: "lighting",
    },
    {
      created_at: "2026-07-22T10:00:00.000Z",
      current_status: "resolved",
      category: "pothole",
    },
    {
      created_at: "2026-07-15T10:00:00.000Z",
      current_status: "rejected",
      category: "trash",
    },
  ];

  it("builds a rolling 7-day volume series", () => {
    const volume = buildVolume7d(rows, now);
    expect(volume).toHaveLength(7);
    expect(volume.at(-1)).toEqual({ day: "2026-07-23", count: 2 });
    expect(volume.at(-2)).toEqual({ day: "2026-07-22", count: 1 });
    expect(volume[0]?.count).toBe(0);
  });

  it("aggregates workload by status", () => {
    expect(buildWorkloadByStatus(rows)).toEqual([
      { status: "new", count: 1 },
      { status: "reviewing", count: 1 },
      { status: "resolved", count: 1 },
      { status: "rejected", count: 1 },
    ]);
  });

  it("returns top categories sorted by count", () => {
    expect(buildTopCategories(rows, 2)).toEqual([
      { category: "pothole", count: 2 },
      { category: "lighting", count: 1 },
    ]);
  });
});
