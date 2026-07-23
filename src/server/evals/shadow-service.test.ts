import { describe, expect, it, vi } from "vitest";

import type { HanoiAnalysis } from "@/server/domain/hanoi-analysis";
import { compareShadowTriage, insertShadowComparison } from "./shadow-service";

const baseline: HanoiAnalysis = {
  category: "pothole",
  matched_known_issue: true,
  observed_facts: ["A large pothole occupies part of one traffic lane."],
  inferences: ["The defect may materially impair mobility."],
  unknowns: ["Pothole depth is unknown."],
  severity: "medium",
  severity_reason:
    "The road defect materially impairs normal lane use without an explicit active hazard.",
  confidence: 0.9,
  handling_type: 2,
  handling_label: "TEMPORARY_SAFE_ACTION",
  allowed_actions: ["Report the exact location from a safe position."],
  prohibited_actions: ["Do not enter the traffic lane or repair the road."],
  recommended_action: "Inspect and schedule authorized road repair.",
  guidance_code: "report_road_damage",
  critical_alert: false,
  requires_human_review: true,
};

const candidate: HanoiAnalysis = {
  ...baseline,
  category: "flooding",
  observed_facts: ["Standing water blocks the crosswalk."],
  severity_reason: "Standing water blocks the crosswalk.",
  severity: "high",
  handling_type: 3,
  handling_label: "KEEP_AWAY",
  guidance_code: "generate_later",
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
      hanoiAnalysis: candidate,
      analysis: {} as never,
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
