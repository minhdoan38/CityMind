import { describe, expect, it, vi } from "vitest";

import type { HanoiAnalysis } from "@/server/domain/hanoi-analysis";
import type { ReportAnalysis } from "@/server/domain/report-analysis";
import { projectToLegacyReportAnalysisFromHanoi } from "@/server/domain/analysis-projection";
import { AnalysisProviderError } from "@/server/ai/openai-compatible";
import { runTriageForReport } from "./service";

const validHanoiAnalysis: HanoiAnalysis = {
  category: "obstruction",
  matched_known_issue: true,
  observed_facts: ["A tree is visibly cracking and leaning over an occupied bus stop."],
  inferences: ["The cracking tree presents an imminent falling-object danger."],
  unknowns: ["The tree's structural condition is unknown."],
  severity: "critical",
  severity_reason:
    "A cracking tree leaning over an occupied area is a directly evidenced imminent danger.",
  confidence: 0.9,
  handling_type: 3,
  handling_label: "KEEP_AWAY",
  allowed_actions: ["Move far outside the potential fall area and report the exact location."],
  prohibited_actions: ["Do not approach, touch, or stand beneath the tree."],
  recommended_action: "Escalate immediately to authorized tree-hazard personnel.",
  guidance_code: "generate_later",
  critical_alert: true,
  requires_human_review: true,
};

const validAnalysis: ReportAnalysis =
  projectToLegacyReportAnalysisFromHanoi(validHanoiAnalysis);

const candidateHanoiAnalysis: HanoiAnalysis = {
  ...validHanoiAnalysis,
  category: "pothole",
  observed_facts: ["A large pothole occupies part of one traffic lane."],
  inferences: ["The defect may materially impair mobility."],
  unknowns: ["Pothole depth is unknown."],
  severity: "medium",
  severity_reason:
    "The road defect materially impairs normal lane use without an explicit active hazard.",
  handling_type: 2,
  handling_label: "TEMPORARY_SAFE_ACTION",
  allowed_actions: ["Report the exact location from a safe position."],
  prohibited_actions: ["Do not enter the traffic lane or repair the road."],
  recommended_action: "Inspect and schedule authorized road repair.",
  guidance_code: "report_road_damage",
  critical_alert: false,
};

function structuredResult(analysis: HanoiAnalysis) {
  return {
    hanoiAnalysis: analysis,
    analysis: projectToLegacyReportAnalysisFromHanoi(analysis),
    lineage: {
      providerLabel: "test",
      responseModel: "test-model",
      requestId: "req-1",
      latencyMs: 10,
    },
    rawContent: JSON.stringify(analysis),
  };
}

function createClient(options: {
  report?: Record<string, unknown> | null;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.report === undefined
      ? {
          report_id: "report-1",
          description: "Tree cracking over occupied bus stop.",
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
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "triage_shadow_comparisons") {
      return { insert };
    }
    if (table === "reports") {
      return { select, update };
    }
    return { select };
  });

  return { from, update, insert };
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
  it("completes when Hanoi policy passes on first attempt", async () => {
    const client = createClient();
    const analyzeStructured = vi.fn(async () => structuredResult(validHanoiAnalysis));
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

  it("routes to manual_review when handling_type 1 is used with medium severity", async () => {
    const client = createClient();
    const invalid: HanoiAnalysis = {
      ...validHanoiAnalysis,
      category: "pothole",
      observed_facts: ["A large pothole occupies part of one traffic lane."],
      inferences: ["The defect may materially impair mobility."],
      unknowns: ["Pothole depth is unknown."],
      severity: "medium",
      severity_reason:
        "The road defect materially impairs normal lane use without an explicit active hazard.",
      handling_type: 1,
      handling_label: "SELF_GUIDANCE",
      allowed_actions: ["Collect debris only if safe."],
      prohibited_actions: ["Do not enter traffic."],
      recommended_action: "Inspect and schedule authorized road repair.",
      guidance_code: "self_collect_safe_litter",
      critical_alert: false,
    };
    const analyzeStructured = vi.fn(async () => structuredResult(invalid));
    const deps = {
      ...createDeps(client),
      analyzeStructured,
    };

    const result = await runTriageForReport("report-1", deps);

    expect(result.disposition).toBe("manual_review");
    expect(analyzeStructured).toHaveBeenCalledTimes(1);
    expect(deps.applyRoutingForReport).toHaveBeenCalledWith(
      deps.client,
      "report-1",
      expect.objectContaining({ disposition: "manual_review" }),
    );
  });

  it("routes to manual_review when critical severity lacks critical_alert", async () => {
    const client = createClient();
    const invalid: HanoiAnalysis = {
      ...validHanoiAnalysis,
      critical_alert: false,
    };
    const analyzeStructured = vi.fn(async () => structuredResult(invalid));
    const deps = {
      ...createDeps(client),
      analyzeStructured,
    };

    const result = await runTriageForReport("report-1", deps);

    expect(result.disposition).toBe("manual_review");
    expect(analyzeStructured).toHaveBeenCalledTimes(1);
  });

  it("does not call applyRoutingForReport on infra retry disposition", async () => {
    const client = createClient({
      report: {
        report_id: "report-1",
        description: "Tree cracking over occupied bus stop.",
        evidence_path: null,
        triage_attempt_count: 0,
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

    expect(result.disposition).toBe("retry");
    expect(deps.applyRoutingForReport).not.toHaveBeenCalled();
  });

  it("routes third infra failure to manual_review", async () => {
    const client = createClient({
      report: {
        report_id: "report-1",
        description: "Tree cracking over occupied bus stop.",
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

  it("dual-runs shadow candidate without updating reports", async () => {
    const client = createClient();
    const analyzeStructured = vi
      .fn()
      .mockResolvedValueOnce(structuredResult(validHanoiAnalysis))
      .mockResolvedValueOnce(structuredResult(candidateHanoiAnalysis));
    const deps = {
      ...createDeps(client),
      analyzeStructured,
      getShadowConfig: () => ({
        mode: "compare" as const,
        candidateModel: "candidate-model",
        candidateBaseUrl: null,
      }),
    };

    const result = await runTriageForReport("report-1", deps);

    expect(result.disposition).toBe("completed");
    expect(analyzeStructured).toHaveBeenCalledTimes(2);
    expect(client.insert).toHaveBeenCalledTimes(1);
    expect(client.update).not.toHaveBeenCalled();
  });
});
