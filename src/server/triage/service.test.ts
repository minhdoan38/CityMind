import { describe, expect, it, vi } from "vitest";

import type { ReportAnalysis } from "@/server/domain/report-analysis";
import { AnalysisProviderError } from "@/server/ai/openai-compatible";
import { runTriageForReport } from "./service";

const validAnalysis: ReportAnalysis = {
  category: "pothole",
  severity: 5,
  confidence: 0.82,
  summary: "Active flooding with imminent danger near the school crossing.",
  recommendation: "Inspect the road and secure the affected lane.",
  priority: "critical",
  estimated_impact: "Safety risk for students and road users.",
  evidence: ["Citizen reports immediate danger from active flooding."],
  uncertainty: ["Exact depth is not verified."],
};

function createClient(options: {
  report?: Record<string, unknown> | null;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.report === undefined
      ? {
          report_id: "report-1",
          description: "Flooding near school crossing with immediate danger.",
          evidence_path: null,
          triage_attempt_count: 0,
        }
      : options.report,
    error: null,
  });
  const eq = vi.fn(() => ({
    limit: vi.fn(() => ({ maybeSingle })),
    maybeSingle,
  }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return { from };
}

function createDeps(client: ReturnType<typeof createClient>) {
  return {
    client: client as never,
    startTriageRun: vi.fn(async () => "run-1"),
    recordTriageAttempt: vi.fn(async () => "run-1"),
    finishTriageRun: vi.fn(async () => undefined),
    applyRoutingForReport: vi.fn(async () => undefined),
  };
}

describe("runTriageForReport", () => {
  it("completes when policy passes on first attempt", async () => {
    const client = createClient();
    const analyzeStructured = vi.fn(async () => ({
      analysis: validAnalysis,
      lineage: {
        providerLabel: "test",
        responseModel: "test-model",
        requestId: "req-1",
        latencyMs: 10,
      },
      rawContent: JSON.stringify(validAnalysis),
    }));
    const deps = {
      ...createDeps(client),
      analyzeStructured,
    };

    const result = await runTriageForReport("report-1", deps);

    expect(result.disposition).toBe("completed");
    expect(analyzeStructured).toHaveBeenCalledTimes(1);
    expect(deps.recordTriageAttempt).toHaveBeenCalled();
    expect(deps.finishTriageRun).toHaveBeenCalledWith(deps.client, "run-1", "completed");
    expect(deps.applyRoutingForReport).toHaveBeenCalledWith(
      deps.client,
      "report-1",
      expect.objectContaining({ disposition: "completed", analysis: validAnalysis }),
    );
  });

  it("retries validation once then completes", async () => {
    const client = createClient();
    const invalid = {
      ...validAnalysis,
      priority: "critical" as const,
      severity: 4 as const,
    };
    const analyzeStructured = vi
      .fn()
      .mockResolvedValueOnce({
        analysis: invalid,
        lineage: {
          providerLabel: "test",
          responseModel: "test-model",
          requestId: "req-1",
          latencyMs: 10,
        },
        rawContent: JSON.stringify(invalid),
      })
      .mockResolvedValueOnce({
        analysis: validAnalysis,
        lineage: {
          providerLabel: "test",
          responseModel: "test-model",
          requestId: "req-2",
          latencyMs: 12,
        },
        rawContent: JSON.stringify(validAnalysis),
      });
    const deps = {
      ...createDeps(client),
      analyzeStructured,
    };

    const result = await runTriageForReport("report-1", deps);

    expect(result.disposition).toBe("completed");
    expect(analyzeStructured).toHaveBeenCalledTimes(2);
  });

  it("routes to manual_review after validation retry still fails", async () => {
    const client = createClient();
    const invalid = {
      ...validAnalysis,
      priority: "critical" as const,
      severity: 4 as const,
    };
    const analyzeStructured = vi.fn(async () => ({
      analysis: invalid,
      lineage: {
        providerLabel: "test",
        responseModel: "test-model",
        requestId: "req-1",
        latencyMs: 10,
      },
      rawContent: JSON.stringify(invalid),
    }));
    const deps = {
      ...createDeps(client),
      analyzeStructured,
    };

    const result = await runTriageForReport("report-1", deps);

    expect(result.disposition).toBe("manual_review");
    expect(analyzeStructured).toHaveBeenCalledTimes(2);
    expect(deps.applyRoutingForReport).toHaveBeenCalledWith(
      deps.client,
      "report-1",
      expect.objectContaining({ disposition: "manual_review" }),
    );
  });

  it("routes third infra failure to manual_review", async () => {
    const client = createClient({
      report: {
        report_id: "report-1",
        description: "Flooding near school crossing with immediate danger.",
        evidence_path: null,
        triage_attempt_count: 2,
      },
    });
    const analyzeStructured = vi.fn(async () => {
      throw new AnalysisProviderError("timeout");
    });
    const deps = {
      ...createDeps(client),
      analyzeStructured,
    };

    const result = await runTriageForReport("report-1", deps);

    expect(result.disposition).toBe("manual_review");
    expect(deps.applyRoutingForReport).toHaveBeenCalledWith(
      deps.client,
      "report-1",
      expect.objectContaining({ disposition: "manual_review" }),
    );
  });

  it("returns failed when report row is missing", async () => {
    const client = createClient({ report: null });
    const deps = createDeps(client);

    const result = await runTriageForReport("missing-report", {
      ...deps,
      analyzeStructured: vi.fn(),
    });
    expect(result.disposition).toBe("failed");
    expect(deps.applyRoutingForReport).not.toHaveBeenCalled();
  });
});
