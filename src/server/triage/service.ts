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
import type { ReportAnalysis } from "@/server/domain/report-analysis";
import {
  downloadEvidenceLocation,
  parseSupabaseEvidenceUri,
} from "@/server/services/evidence-service";
import type { PolicyViolation } from "@/server/validation/analysis-policy";
import { validateAnalysisPolicy } from "@/server/validation/analysis-policy";
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

function buildValidationRetryInstruction(violations: PolicyViolation[]): string {
  const lines = violations.map((item) => `- ${item.code}: ${item.message}`).join("\n");
  return `Previous output failed semantic validation. Fix these issues and return valid JSON only:\n${lines}`;
}

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

  const location = parseSupabaseEvidenceUri(`supabase://${evidencePath}`);
  const { bytes, mimeType } = await downloadEvidenceLocation({
    client,
    bucketName: location.bucket,
    objectPath: location.objectPath,
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

async function updateTriageTerminalState(
  client: SupabaseClient,
  reportId: string,
  fields: {
    triage_status: "completed" | "manual_review" | "failed" | "retry";
    triage_error?: string | null;
    triage_next_attempt_at?: string | null;
    triage_attempt_count?: number;
    analysis?: ReportAnalysis;
    triaged_at?: string | null;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {
    triage_status: fields.triage_status,
    triage_claimed_at: null,
  };

  if (fields.triage_error !== undefined) {
    payload.triage_error = fields.triage_error;
  }
  if (fields.triage_next_attempt_at !== undefined) {
    payload.triage_next_attempt_at = fields.triage_next_attempt_at;
  }
  if (fields.triage_attempt_count !== undefined) {
    payload.triage_attempt_count = fields.triage_attempt_count;
  }
  if (fields.triaged_at !== undefined) {
    payload.triaged_at = fields.triaged_at;
  }

  if (fields.analysis) {
    payload.category = fields.analysis.category;
    payload.severity = fields.analysis.severity;
    payload.confidence = fields.analysis.confidence;
    payload.summary = fields.analysis.summary;
    payload.recommendation = fields.analysis.recommendation;
    payload.priority = fields.analysis.priority;
    payload.estimated_impact = fields.analysis.estimated_impact;
    payload.evidence = fields.analysis.evidence;
    payload.uncertainty = fields.analysis.uncertainty;
  }

  const { error } = await client.from("reports").update(payload).eq("report_id", reportId);
  if (error) {
    throw error;
  }
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
    analysis?: ReportAnalysis | null;
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
    baseline: ReportAnalysis;
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

  let retryInstruction: string | undefined;

  for (let validationAttempt = 0; validationAttempt < 2; validationAttempt += 1) {
    let structured: StructuredAnalysisResult;
    try {
      structured = await callProvider(deps, { description, image }, retryInstruction);
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
    const policyResult = validateAnalysisPolicy(structured.analysis, { description });
    if (policyResult.ok) {
      await persistAttempt(deps, {
        reportId,
        runId,
        attemptNumber,
        structured,
        validationErrors: [],
        disposition: "completed",
        analysis: structured.analysis,
        finishRun: true,
      });
      await finishRun(deps.client, runId, "completed");
      await applyTerminalRouting(deps, reportId, "completed", structured.analysis);
      await runShadowComparisonIfEnabled(deps, {
        reportId,
        runId,
        baseline: structured.analysis,
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
      disposition: "retry",
    });

    if (validationAttempt === 0) {
      retryInstruction = buildValidationRetryInstruction(policyResult.violations);
      continue;
    }

    await persistAttempt(deps, {
      reportId,
      runId,
      attemptNumber: attemptNumber + 1,
      structured,
      validationErrors: policyResult.violations,
      disposition: "manual_review",
      finishRun: true,
    });
    await finishRun(deps.client, runId, "manual_review");
    await applyTerminalRouting(deps, reportId, "manual_review", structured.analysis);
    return { reportId, disposition: "manual_review" };
  }

  await finishRun(deps.client, runId, "manual_review");
  await applyTerminalRouting(deps, reportId, "manual_review");
  return { reportId, disposition: "manual_review" };
}
