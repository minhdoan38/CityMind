import { describe, expect, it } from "vitest";

import {
  computeOperationalMetrics,
  formatTriageDuration,
  isReportSlaOverdue,
} from "@/lib/dashboard-operational-metrics";

describe("computeOperationalMetrics", () => {
  const now = Date.parse("2026-07-23T12:00:00.000Z");

  it("counts operational buckets from filtered rows", () => {
    const metrics = computeOperationalMetrics(
      [
        {
          triage_status: "manual_review",
          priority: "high",
          current_status: "new",
          created_at: "2026-07-23T10:00:00.000Z",
          triaged_at: "2026-07-23T10:05:00.000Z",
        },
        {
          triage_status: "failed",
          priority: "medium",
          current_status: "reviewing",
          created_at: "2026-07-19T12:00:00.000Z",
          triaged_at: null,
        },
        {
          triage_status: "completed",
          priority: "critical",
          current_status: "new",
          created_at: "2026-07-22T11:00:00.000Z",
          triaged_at: "2026-07-22T12:10:00.000Z",
        },
        {
          triage_status: "completed",
          priority: "low",
          current_status: "resolved",
          created_at: "2026-07-01T12:00:00.000Z",
          triaged_at: "2026-07-01T13:00:00.000Z",
        },
      ],
      now,
    );

    expect(metrics.needs_review_reports).toBe(1);
    expect(metrics.ai_failed_reports).toBe(1);
    expect(metrics.critical_reports).toBe(1);
    expect(metrics.sla_overdue_reports).toBe(2);
    expect(metrics.avg_triage_seconds).toBe(2700);
  });
});

describe("isReportSlaOverdue", () => {
  const now = Date.parse("2026-07-23T12:00:00.000Z");

  it("uses priority-based SLA windows for open reports", () => {
    expect(
      isReportSlaOverdue(
        {
          triage_status: "completed",
          priority: "critical",
          current_status: "new",
          created_at: "2026-07-22T11:00:00.000Z",
          triaged_at: null,
        },
        now,
      ),
    ).toBe(true);

    expect(
      isReportSlaOverdue(
        {
          triage_status: "completed",
          priority: "critical",
          current_status: "resolved",
          created_at: "2026-07-20T12:00:00.000Z",
          triaged_at: null,
        },
        now,
      ),
    ).toBe(false);
  });
});

describe("formatTriageDuration", () => {
  it("formats seconds into compact officer-facing units", () => {
    expect(formatTriageDuration(null)).toBe("—");
    expect(formatTriageDuration(45)).toBe("45s");
    expect(formatTriageDuration(300)).toBe("5m");
    expect(formatTriageDuration(5400)).toBe("1.5h");
    expect(formatTriageDuration(90_000)).toBe("1.0d");
  });
});
