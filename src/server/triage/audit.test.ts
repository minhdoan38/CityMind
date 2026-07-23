import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordTriageAttempt, startTriageRun } from "./audit";

describe("audit writers", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://supabase.example.com";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.AI_BASE_URL = "https://ai.example.com/v1";
    process.env.AI_MODEL = "configured-model";
    process.env.AI_PROVIDER_LABEL = "third-party";
    process.env.THIRD_PARTY_API_KEY = "secret-api-key-value";
    process.env.AI_SUPPORTS_VISION = "false";
    process.env.AI_TIMEOUT_MS = "30000";
  });

  it("creates triage run row", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { run_id: "run-1" },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    const client = { from } as never;

    const runId = await startTriageRun(client, "report-1");

    expect(runId).toBe("run-1");
    expect(insert).toHaveBeenCalledWith({
      report_id: "report-1",
      prompt_version: "5.2.0",
    });
  });

  it("records attempt via complete_triage_report RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { run_id: "run-1" }, error: null });
    const client = { rpc } as never;

    const runId = await recordTriageAttempt(client, {
      reportId: "report-1",
      runId: "run-1",
      attemptNumber: 1,
      model: "test-model",
      rawOutput: '{"category":"pothole"}',
      latencyMs: 12,
      validationErrors: [],
      disposition: "completed",
      analysis: {
        category: "pothole",
        severity: 4,
        confidence: 0.8,
        summary: "Large pothole near a school entrance.",
        recommendation: "Inspect the road and secure the affected lane.",
        priority: "high",
        estimated_impact: "Safety risk for students and road users.",
        evidence: ["Citizen description identifies a large pothole."],
        uncertainty: ["Exact dimensions are not verified."],
      },
      finishRun: true,
    });

    expect(runId).toBe("run-1");
    expect(rpc).toHaveBeenCalledWith(
      "complete_triage_report",
      expect.objectContaining({
        p_report_id: "report-1",
        p_disposition: "completed",
      }),
    );
  });
});
