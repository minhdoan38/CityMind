import { describe, expect, it, vi } from "vitest";

import type { ReportAnalysis } from "@/server/domain/report-analysis";
import { compareShadowTriage, insertShadowComparison } from "./shadow-service";

const baseline: ReportAnalysis = {
  category: "pothole",
  severity: 3,
  confidence: 0.82,
  summary: "Pothole near the school crossing with moderate depth.",
  recommendation: "Schedule road repair inspection within the week.",
  priority: "medium",
  estimated_impact: "Localized traffic disruption for school route.",
  evidence: ["Visible pothole in citizen photo near crossing."],
  uncertainty: ["Exact depth is not verified."],
};

const candidate: ReportAnalysis = {
  ...baseline,
  category: "flooding",
  priority: "high",
};

function createClient() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "triage_shadow_comparisons") {
      return { insert };
    }
    if (table === "reports") {
      return { update };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { from, insert, update };
}

describe("insertShadowComparison", () => {
  it("inserts into triage_shadow_comparisons only", async () => {
    const client = createClient();

    await insertShadowComparison(client as never, {
      reportId: "report-1",
      productionRunId: "run-1",
      candidateModel: "candidate-model",
      candidatePromptVersion: "1.0.0",
      baselineSnapshot: baseline,
      candidateSnapshot: candidate,
      disagreement: { category: true, severity: false, priority: true },
      hasDisagreement: true,
    });

    expect(client.insert).toHaveBeenCalledTimes(1);
    expect(client.update).not.toHaveBeenCalled();
  });
});

describe("compareShadowTriage", () => {
  it("no-ops when shadow mode is off", async () => {
    const client = createClient();
    const analyzeStructured = vi.fn();

    await compareShadowTriage(
      {
        client: client as never,
        getShadowConfig: () => ({
          mode: "off",
          candidateModel: "candidate-model",
          candidateBaseUrl: null,
        }),
        analyzeStructured,
      },
      {
        reportId: "report-1",
        productionRunId: "run-1",
        baseline,
        description: "Pothole near crossing.",
      },
    );

    expect(analyzeStructured).not.toHaveBeenCalled();
    expect(client.insert).not.toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
  });

  it("no-ops when candidate model is unset", async () => {
    const client = createClient();
    const analyzeStructured = vi.fn();

    await compareShadowTriage(
      {
        client: client as never,
        getShadowConfig: () => ({
          mode: "compare",
          candidateModel: null,
          candidateBaseUrl: null,
        }),
        analyzeStructured,
      },
      {
        reportId: "report-1",
        productionRunId: "run-1",
        baseline,
        description: "Pothole near crossing.",
      },
    );

    expect(analyzeStructured).not.toHaveBeenCalled();
    expect(client.insert).not.toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
  });

  it("persists disagreement without updating reports", async () => {
    const client = createClient();
    const analyzeStructured = vi.fn(async () => ({
      analysis: candidate,
      lineage: {
        providerLabel: "test",
        responseModel: "candidate-model",
        requestId: "req-1",
        latencyMs: 12,
      },
      rawContent: JSON.stringify(candidate),
    }));

    await compareShadowTriage(
      {
        client: client as never,
        getShadowConfig: () => ({
          mode: "compare",
          candidateModel: "candidate-model",
          candidateBaseUrl: null,
        }),
        analyzeStructured,
      },
      {
        reportId: "report-1",
        productionRunId: "run-1",
        baseline,
        description: "Pothole near crossing.",
      },
    );

    expect(analyzeStructured).toHaveBeenCalledTimes(1);
    expect(client.insert).toHaveBeenCalledTimes(1);
    expect(client.update).not.toHaveBeenCalled();

    const payload = client.insert.mock.calls[0]?.[0];
    expect(payload.has_disagreement).toBe(true);
    expect(payload.disagreement).toMatchObject({
      category: true,
      priority: true,
    });
  });

  it("stores candidate failure metadata without throwing", async () => {
    const client = createClient();
    const analyzeStructured = vi.fn(async () => {
      throw new Error("provider_timeout");
    });

    await compareShadowTriage(
      {
        client: client as never,
        getShadowConfig: () => ({
          mode: "compare",
          candidateModel: "candidate-model",
          candidateBaseUrl: null,
        }),
        analyzeStructured,
      },
      {
        reportId: "report-1",
        productionRunId: "run-1",
        baseline,
        description: "Pothole near crossing.",
      },
    );

    expect(client.insert).toHaveBeenCalledTimes(1);
    expect(client.update).not.toHaveBeenCalled();

    const payload = client.insert.mock.calls[0]?.[0];
    expect(payload.candidate_snapshot).toBeNull();
    expect(payload.has_disagreement).toBe(false);
    expect(payload.disagreement).toMatchObject({
      error: "provider_timeout",
    });
  });
});
