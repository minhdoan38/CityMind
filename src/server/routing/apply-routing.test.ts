import { describe, expect, it, vi } from "vitest";

import type { ReportAnalysis } from "@/server/domain/report-analysis";
import { ROUTING_POLICY_VERSION } from "./policy";
import { applyRoutingForReport } from "./apply-routing";

const eligibleAnalysis: ReportAnalysis = {
  category: "pothole",
  severity: 2,
  confidence: 0.82,
  summary: "Small pothole on a residential street.",
  recommendation: "Monitor and fill when crew is nearby.",
  priority: "low",
  estimated_impact: "Minor trip hazard.",
  evidence: ["Citizen reports a shallow pothole."],
  uncertainty: ["Exact depth is not verified."],
};

function createClient() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { from, update, eq };
}

describe("applyRoutingForReport", () => {
  it("persists self_help for completed eligible analysis", async () => {
    const client = createClient();
    await applyRoutingForReport(client as never, "report-1", {
      disposition: "completed",
      analysis: eligibleAnalysis,
    });

    expect(client.update).toHaveBeenCalledWith({
      routing_destination: "self_help",
      routing_reason: "eligible_category_low_severity",
      routing_policy_version: ROUTING_POLICY_VERSION,
      routed_at: expect.any(String),
    });
    expect(client.eq).toHaveBeenCalledWith("report_id", "report-1");
  });

  it("persists government for completed high severity analysis", async () => {
    const client = createClient();
    await applyRoutingForReport(client as never, "report-2", {
      disposition: "completed",
      analysis: { ...eligibleAnalysis, severity: 4, priority: "high" },
    });

    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        routing_destination: "government",
        routing_reason: "severity_or_priority",
        routing_policy_version: ROUTING_POLICY_VERSION,
      }),
    );
  });

  it("forces government on manual_review regardless of analysis", async () => {
    const client = createClient();
    await applyRoutingForReport(client as never, "report-3", {
      disposition: "manual_review",
      analysis: eligibleAnalysis,
    });

    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        routing_destination: "government",
        routing_reason: "triage_manual_or_failed",
      }),
    );
  });

  it("forces government on failed disposition without analysis", async () => {
    const client = createClient();
    await applyRoutingForReport(client as never, "report-4", {
      disposition: "failed",
      analysis: null,
    });

    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        routing_destination: "government",
        routing_reason: "triage_manual_or_failed",
      }),
    );
  });
});
