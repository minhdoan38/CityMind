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
  updateError?: Error | null;
} = {}) {
  const updateEq = vi.fn().mockResolvedValue({ error: options.updateError ?? null });
  const update = vi.fn(() => ({ eq: updateEq }));
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
  const from = vi.fn((table: string) => {
    if (table === "reports") {
      return { select, update, eq };
    }
    return { select, update, eq };
  });

  return { from, update, updateEq, eq };
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

    const result = await runTriageForReport("report-1", {
      client: client as never,
      analyzeStructured,
    });

    expect(result.disposition).toBe("completed");
    expect(analyzeStructured).toHaveBeenCalledTimes(1);
    expect(client.update).toHaveBeenCalled();
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

    const result = await runTriageForReport("report-1", {
      client: client as never,
      analyzeStructured,
    });

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

    const result = await runTriageForReport("report-1", {
      client: client as never,
      analyzeStructured,
    });

    expect(result.disposition).toBe("manual_review");
    expect(analyzeStructured).toHaveBeenCalledTimes(2);
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

    const result = await runTriageForReport("report-1", {
      client: client as never,
      analyzeStructured,
    });

    expect(result.disposition).toBe("manual_review");
  });

  it("returns failed when report row is missing", async () => {
    const client = createClient({ report: null });
    const result = await runTriageForReport("missing-report", {
      client: client as never,
      analyzeStructured: vi.fn(),
    });
    expect(result.disposition).toBe("failed");
  });
});
