import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminClient } from "@/lib/supabase/admin";
import {
  AnalysisProviderError,
  analyzeStructured,
  type StructuredAnalysisResult,
} from "@/server/ai/openai-compatible";
import { getServerEnv } from "@/server/config/env";
import type { ReportAnalysis } from "@/server/domain/report-analysis";
import {
  downloadEvidenceLocation,
  parseSupabaseEvidenceUri,
} from "@/server/services/evidence-service";
import type { PolicyViolation } from "@/server/validation/analysis-policy";
import { validateAnalysisPolicy } from "@/server/validation/analysis-policy";
import { infraBackoffMs, MAX_INFRA_ATTEMPTS } from "./config";
import { resolveInfraFailureDisposition } from "./disposition";

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

async function handleInfraFailure(
  client: SupabaseClient,
  reportId: string,
  attemptCount: number,
): Promise<TriageRunResult> {
  const nextAttempt = attemptCount + 1;
  const disposition = resolveInfraFailureDisposition(nextAttempt, MAX_INFRA_ATTEMPTS);
  await updateTriageTerminalState(client, reportId, {
    triage_status: disposition,
    triage_attempt_count: nextAttempt,
    triage_next_attempt_at:
      disposition === "retry"
        ? new Date(Date.now() + infraBackoffMs(nextAttempt - 1)).toISOString()
        : null,
    triaged_at: disposition === "manual_review" ? new Date().toISOString() : null,
  });
  return { reportId, disposition };
}

export async function runTriageForReport(
  reportId: string,
  deps: TriageServiceDeps = { client: getAdminClient() },
): Promise<TriageRunResult> {
  const row = await loadReportRow(deps.client, reportId);
  if (!row) {
    return { reportId, disposition: "failed" };
  }

  const description = row.description?.trim() ?? "";
  if (!description && !row.evidence_path) {
    await updateTriageTerminalState(deps.client, reportId, {
      triage_status: "failed",
      triage_error: "missing_intake_payload",
      triaged_at: new Date().toISOString(),
    });
    return { reportId, disposition: "failed" };
  }

  let image;
  try {
    image = await loadEvidenceImage(deps.client, row.evidence_path);
  } catch {
    return handleInfraFailure(deps.client, reportId, row.triage_attempt_count);
  }

  let retryInstruction: string | undefined;

  for (let validationAttempt = 0; validationAttempt < 2; validationAttempt += 1) {
    let structured: StructuredAnalysisResult;
    try {
      structured = await callProvider(
        deps,
        { description, image },
        retryInstruction,
      );
    } catch (error) {
      if (error instanceof AnalysisProviderError) {
        return handleInfraFailure(deps.client, reportId, row.triage_attempt_count);
      }
      await updateTriageTerminalState(deps.client, reportId, {
        triage_status: "failed",
        triage_error: "unrecoverable_triage_error",
        triaged_at: new Date().toISOString(),
      });
      return { reportId, disposition: "failed" };
    }

    const policyResult = validateAnalysisPolicy(structured.analysis, { description });
    if (policyResult.ok) {
      await updateTriageTerminalState(deps.client, reportId, {
        triage_status: "completed",
        analysis: structured.analysis,
        triaged_at: new Date().toISOString(),
        triage_error: null,
        triage_next_attempt_at: null,
      });
      return { reportId, disposition: "completed" };
    }

    if (validationAttempt === 0) {
      retryInstruction = buildValidationRetryInstruction(policyResult.violations);
      continue;
    }

    await updateTriageTerminalState(deps.client, reportId, {
      triage_status: "manual_review",
      triaged_at: new Date().toISOString(),
      triage_error: null,
      triage_next_attempt_at: null,
    });
    return { reportId, disposition: "manual_review" };
  }

  await updateTriageTerminalState(deps.client, reportId, {
    triage_status: "manual_review",
    triaged_at: new Date().toISOString(),
  });
  return { reportId, disposition: "manual_review" };
}
