import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminClient } from "@/lib/supabase/admin";
import {
  AnalysisProviderError,
  analyzeStructured,
  type StructuredAnalysisResult,
} from "@/server/ai/openai-compatible";
import { getServerEnv, getShadowConfig } from "@/server/config/env";
import { compareShadowTriage } from "@/server/evals/shadow-service";
import { projectHanoiPayloadForRpc } from "@/server/domain/analysis-projection";
import type { HanoiAnalysis } from "@/server/domain/hanoi-analysis";
import type { ReportAnalysis } from "@/server/domain/report-analysis";
import {
  downloadEvidenceLocation,
} from "@/server/services/evidence-service";
import type { PolicyViolation } from "@/server/validation/hanoi-policy";
import { validateHanoiPolicy } from "@/server/validation/hanoi-policy";
import { MAX_INFRA_ATTEMPTS } from "./config";
import { finishTriageRun, recordTriageAttempt, startTriageRun } from "./audit";
import { resolveInfraFailureDisposition } from "./disposition";
import {
  applyRoutingForReport,
  type ApplyRoutingContext,
} from "@/server/routing/apply-routing";

export type TriageReportRow = {
  report_id: string;
  description: string | null;
  evidence_path: string | null;
  triage_attempt_count: number;
};

export type TriageRunResult = {
  reportId: string;
  disposition: "completed" | "manual_review" | "failed" | "retry";
};

export type TriageServiceDeps = {
  client: SupabaseClient;
  analyzeStructured?: (
    input: {
      description: string;
      image?: {
        bytes: Uint8Array;
        mimeType: "image/jpeg" | "image/png" | "image/webp";
      };
    },
    systemInstruction?: string,
  ) => Promise<StructuredAnalysisResult>;
  candidateAnalyzeStructured?: TriageServiceDeps["analyzeStructured"];
  startTriageRun?: typeof startTriageRun;
  recordTriageAttempt?: typeof recordTriageAttempt;
  finishTriageRun?: typeof finishTriageRun;
  applyRoutingForReport?: typeof applyRoutingForReport;
  compareShadowTriage?: typeof compareShadowTriage;
  getShadowConfig?: typeof getShadowConfig;
};

async function loadReportRow(
  client: SupabaseClient,
  reportId: string,
): Promise<TriageReportRow | null> {
  const { data, error } = await client
    .from("reports")
    .select("report_id, description, evidence_path, triage_attempt_count")
    .eq("report_id", reportId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return {
    report_id: String(data.report_id),
    description: (data.description as string | null) ?? null,
    evidence_path: (data.evidence_path as string | null) ?? null,
    triage_attempt_count: Number(data.triage_attempt_count ?? 0),
  };
}

async function loadEvidenceImage(
  client: SupabaseClient,
  evidencePath: string | null,
): Promise<
  { bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" | "image/webp" } | undefined
> {
  if (!evidencePath) {
    return undefined;
  }

  const { bytes, mimeType } = await downloadEvidenceLocation({
    client,
    evidencePath,
  });

  if (
    mimeType !== "image/jpeg" &&
    mimeType !== "image/png" &&
    mimeType !== "image/webp"
  ) {
    return undefined;
  }

  return { bytes, mimeType };
}

async function callProvider(
  deps: TriageServiceDeps,
  input: {
    description: string;
    image?: { bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" | "image/webp" };
  },
  systemInstruction?: string,
): Promise<StructuredAnalysisResult> {
  if (deps.analyzeStructured) {
    return deps.analyzeStructured(input, systemInstruction);
  }

  return analyzeStructured({ env: getServerEnv() }, input, systemInstruction);
}

async function persistAttempt(
  deps: TriageServiceDeps,
  input: {
    reportId: string;
    runId: string;
    attemptNumber: number;
    structured?: StructuredAnalysisResult;
    validationErrors: PolicyViolation[];
    disposition: string;
    analysis?: HanoiAnalysis | Record<string, unknown> | null;
    finishRun?: boolean;
  },
): Promise<void> {
  const record = deps.recordTriageAttempt ?? recordTriageAttempt;
  await record(deps.client, {
    reportId: input.reportId,
    runId: input.runId,
    attemptNumber: input.attemptNumber,
    model: input.structured?.lineage.responseModel ?? null,
    rawOutput: input.structured?.rawContent ?? "",
    latencyMs: input.structured?.lineage.latencyMs ?? 0,
    validationErrors: input.validationErrors,
    disposition: input.disposition,
    analysis: input.analysis ?? null,
    finishRun: input.finishRun,
  });
}

async function handleInfraFailure(
  client: SupabaseClient,
  reportId: string,
  attemptCount: number,
  deps: TriageServiceDeps,
  runId: string,
  attemptNumber: number,
): Promise<TriageRunResult> {
  const nextAttempt = attemptCount + 1;
  const disposition = resolveInfraFailureDisposition(nextAttempt, MAX_INFRA_ATTEMPTS);
  await persistAttempt(deps, {
    reportId,
    runId,
    attemptNumber,
    validationErrors: [],
    disposition,
    finishRun: disposition !== "retry",
  });
  if (disposition !== "retry") {
    const finish = deps.finishTriageRun ?? finishTriageRun;
    await finish(client, runId, disposition);
    await applyTerminalRouting(deps, reportId, disposition);
  }
  return { reportId, disposition };
}

async function applyTerminalRouting(
  deps: TriageServiceDeps,
  reportId: string,
  disposition: ApplyRoutingContext["disposition"],
  analysis?: ReportAnalysis | null,
): Promise<void> {
  const apply = deps.applyRoutingForReport ?? applyRoutingForReport;
  await apply(deps.client, reportId, { disposition, analysis: analysis ?? null });
}

async function runShadowComparisonIfEnabled(
  deps: TriageServiceDeps,
  input: {
    reportId: string;
    runId: string;
    baseline: HanoiAnalysis;
    description: string;
    image?: { bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" | "image/webp" };
  },
): Promise<void> {
  const shadowConfig = deps.getShadowConfig?.() ?? getShadowConfig();
  if (shadowConfig.mode !== "compare") {
    return;
  }

  const compare = deps.compareShadowTriage ?? compareShadowTriage;
  await compare(
    {
      client: deps.client,
      getShadowConfig: () => shadowConfig,
      analyzeStructured: deps.candidateAnalyzeStructured ?? deps.analyzeStructured,
    },
    {
      reportId: input.reportId,
      productionRunId: input.runId,
      baseline: input.baseline,
      description: input.description,
      image: input.image,
    },
  );
}

export async function runTriageForReport(
  reportId: string,
  deps: TriageServiceDeps = { client: getAdminClient() },
): Promise<TriageRunResult> {
  const row = await loadReportRow(deps.client, reportId);
  if (!row) {
    return { reportId, disposition: "failed" };
  }

  const startRun = deps.startTriageRun ?? startTriageRun;
  const finishRun = deps.finishTriageRun ?? finishTriageRun;
  const runId = await startRun(deps.client, reportId);
  let attemptNumber = 0;

  const description = row.description?.trim() ?? "";
  if (!description && !row.evidence_path) {
    attemptNumber += 1;
    await persistAttempt(deps, {
      reportId,
      runId,
      attemptNumber,
      validationErrors: [],
      disposition: "failed",
      finishRun: true,
    });
    await finishRun(deps.client, runId, "failed");
    await applyTerminalRouting(deps, reportId, "failed");
    return { reportId, disposition: "failed" };
  }

  let image;
  try {
    image = await loadEvidenceImage(deps.client, row.evidence_path);
  } catch {
    attemptNumber += 1;
    return handleInfraFailure(
      deps.client,
      reportId,
      row.triage_attempt_count,
      deps,
      runId,
      attemptNumber,
    );
  }

  let structured: StructuredAnalysisResult;
  try {
    structured = await callProvider(deps, { description, image });
  } catch (error) {
    if (error instanceof AnalysisProviderError) {
      attemptNumber += 1;
      return handleInfraFailure(
        deps.client,
        reportId,
        row.triage_attempt_count,
        deps,
        runId,
        attemptNumber,
      );
    }
    attemptNumber += 1;
    await persistAttempt(deps, {
      reportId,
      runId,
      attemptNumber,
      validationErrors: [],
      disposition: "failed",
      finishRun: true,
    });
    await finishRun(deps.client, runId, "failed");
    await applyTerminalRouting(deps, reportId, "failed");
    return { reportId, disposition: "failed" };
  }

  attemptNumber += 1;
  const legacyAnalysis = structured.analysis;
  const policyResult = validateHanoiPolicy(structured.hanoiAnalysis);
  const rpcPayload = projectHanoiPayloadForRpc(structured.hanoiAnalysis);
  if (policyResult.ok) {
    await persistAttempt(deps, {
      reportId,
      runId,
      attemptNumber,
      structured,
      validationErrors: [],
      disposition: "completed",
      analysis: rpcPayload,
      finishRun: true,
    });
    await finishRun(deps.client, runId, "completed");
    await applyTerminalRouting(deps, reportId, "completed", legacyAnalysis);
    await runShadowComparisonIfEnabled(deps, {
      reportId,
      runId,
      baseline: structured.hanoiAnalysis,
      description,
      image,
    });
    return { reportId, disposition: "completed" };
  }

  await persistAttempt(deps, {
    reportId,
    runId,
    attemptNumber,
    structured,
    validationErrors: policyResult.violations,
    disposition: "manual_review",
    finishRun: true,
  });
  await finishRun(deps.client, runId, "manual_review");
  await applyTerminalRouting(deps, reportId, "manual_review", legacyAnalysis);
  return { reportId, disposition: "manual_review" };
}
