import { describe, expect, it } from "vitest";

import {
  confidenceBand,
  formatReportAge,
  getSlaUrgency,
  reportRowSurfaceTone,
  severityTone,
} from "./report-row-urgency";

describe("report-row-urgency", () => {
  const now = Date.parse("2026-07-23T12:00:00.000Z");

  it("classifies SLA urgency from priority windows", () => {
    const created = "2026-07-22T11:00:00.000Z";
    expect(
      getSlaUrgency(
        { created_at: created, priority: "critical", status: "new" },
        now,
      ),
    ).toBe("overdue");

    expect(
      getSlaUrgency(
        { created_at: "2026-07-22T18:00:00.000Z", priority: "critical", status: "new" },
        now,
      ),
    ).toBe("due");

    expect(
      getSlaUrgency(
        { created_at: "2026-07-23T08:00:00.000Z", priority: "critical", status: "new" },
        now,
      ),
    ).toBe("ok");

    expect(
      getSlaUrgency(
        { created_at: created, priority: "critical", status: "resolved" },
        now,
      ),
    ).toBe("closed");
  });

  it("maps severity and confidence bands", () => {
    expect(severityTone(5)).toBe("critical");
    expect(severityTone(3)).toBe("mid");
    expect(confidenceBand(0.2)).toBe("low");
    expect(confidenceBand(0.5)).toBe("medium");
    expect(confidenceBand(0.9)).toBe("high");
  });

  it("derives row surface tone from SLA and priority", () => {
    expect(
      reportRowSurfaceTone(
        {
          created_at: "2026-07-20T11:00:00.000Z",
          priority: "medium",
          status: "new",
          severity: 2,
        },
        now,
      ),
    ).toBe("urgent");

    expect(
      reportRowSurfaceTone(
        {
          created_at: "2026-07-23T08:00:00.000Z",
          priority: "critical",
          status: "new",
          severity: 4,
        },
        now,
      ),
    ).toBe("elevated");
  });

  it("formats relative age", () => {
    const label = formatReportAge("2026-07-23T10:00:00.000Z", "en");
    expect(label.length).toBeGreaterThan(0);
  });
});
