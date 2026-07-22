import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  analyzeStructured,
  type StructuredAnalysisResult,
} from "@/server/ai/openai-compatible";
import { getServerEnv } from "@/server/config/env";
import type { ReportAnalysis } from "@/server/domain/report-analysis";
import { ROUTING_POLICY_VERSION } from "@/server/routing/policy";
import { compareShadowTriage as buildShadowDisagreement } from "./shadow-compare";

export type ShadowConfig = {
  mode: "off" | "compare";
  candidateModel: string | null;
  candidateBaseUrl: string | null;
};

export type ShadowComparisonInsert = {
  reportId: string;
  productionRunId: string;
  candidateModel: string;
  candidatePromptVersion: string;
  baselineSnapshot: ReportAnalysis;
  candidateSnapshot: ReportAnalysis | null;
  disagreement: Record<string, unknown>;
  hasDisagreement: boolean;
};

export type CompareShadowTriageInput = {
  reportId: string;
  productionRunId: string;
  baseline: ReportAnalysis;
  description: string;
  image?: {
    bytes: Uint8Array;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
  };
};

export type ShadowServiceDeps = {
  client: SupabaseClient;
  getShadowConfig?: () => ShadowConfig;
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

export type ShadowComparisonRow = {
  comparison_id: string;
  report_id: string;
  production_run_id: string;
  candidate_model: string;
  candidate_prompt_version: string;
  baseline_snapshot: ReportAnalysis;
  candidate_snapshot: ReportAnalysis | null;
  disagreement: Record<string, unknown>;
  has_disagreement: boolean;
  compared_at: string;
};

const OFF_SHADOW_CONFIG: ShadowConfig = {
  mode: "off",
  candidateModel: null,
  candidateBaseUrl: null,
};

export async function insertShadowComparison(
  client: SupabaseClient,
  row: ShadowComparisonInsert,
): Promise<void> {
  const { error } = await client.from("triage_shadow_comparisons").insert({
    report_id: row.reportId,
    production_run_id: row.productionRunId,
    candidate_model: row.candidateModel,
    candidate_prompt_version: row.candidatePromptVersion,
    baseline_snapshot: row.baselineSnapshot,
    candidate_snapshot: row.candidateSnapshot,
    disagreement: row.disagreement,
    has_disagreement: row.hasDisagreement,
  });

  if (error) {
    throw error;
  }
}

function resolveShadowConfig(deps: ShadowServiceDeps): ShadowConfig {
  return deps.getShadowConfig?.() ?? OFF_SHADOW_CONFIG;
}

function buildCandidateEnv(config: ShadowConfig) {
  const base = getServerEnv();
  if (!config.candidateModel) {
    return null;
  }

  return {
    ...base,
    AI_MODEL: config.candidateModel,
    AI_BASE_URL: config.candidateBaseUrl?.trim()
      ? config.candidateBaseUrl.trim().replace(/\/+$/, "")
      : base.AI_BASE_URL,
  };
}

async function callCandidateAnalyze(
  deps: ShadowServiceDeps,
  config: ShadowConfig,
  input: CompareShadowTriageInput,
): Promise<StructuredAnalysisResult> {
  if (deps.analyzeStructured) {
    return deps.analyzeStructured(
      { description: input.description, image: input.image },
    );
  }

  const candidateEnv = buildCandidateEnv(config);
  if (!candidateEnv) {
    throw new Error("candidate_model_unset");
  }

  return analyzeStructured(
    { env: candidateEnv },
    { description: input.description, image: input.image },
  );
}

export async function compareShadowTriage(
  deps: ShadowServiceDeps,
  input: CompareShadowTriageInput,
): Promise<void> {
  const config = resolveShadowConfig(deps);
  if (config.mode !== "compare" || !config.candidateModel?.trim()) {
    return;
  }

  let candidateSnapshot: ReportAnalysis | null = null;
  let disagreementPayload: Record<string, unknown> = {
    category: false,
    severity: false,
    priority: false,
  };
  let hasDisagreement = false;

  try {
    const structured = await callCandidateAnalyze(deps, config, input);
    candidateSnapshot = structured.analysis;
    const comparison = buildShadowDisagreement(input.baseline, candidateSnapshot);
    disagreementPayload = { ...comparison.disagreement };
    hasDisagreement = comparison.has_disagreement;
  } catch (error) {
    disagreementPayload = {
      category: false,
      severity: false,
      priority: false,
      error:
        error instanceof Error ? error.message : "candidate_analyze_failed",
    };
    hasDisagreement = false;
  }

  await insertShadowComparison(deps.client, {
    reportId: input.reportId,
    productionRunId: input.productionRunId,
    candidateModel: config.candidateModel,
    candidatePromptVersion: ROUTING_POLICY_VERSION,
    baselineSnapshot: input.baseline,
    candidateSnapshot,
    disagreement: disagreementPayload,
    hasDisagreement,
  });
}

export async function fetchLatestShadowComparison(
  client: SupabaseClient,
  reportId: string,
): Promise<ShadowComparisonRow | null> {
  const { data, error } = await client
    .from("triage_shadow_comparisons")
    .select(
      "comparison_id, report_id, production_run_id, candidate_model, candidate_prompt_version, baseline_snapshot, candidate_snapshot, disagreement, has_disagreement, compared_at",
    )
    .eq("report_id", reportId)
    .order("compared_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return data as ShadowComparisonRow;
}

export async function fetchShadowDisagreementFlags(
  client: SupabaseClient,
  reportIds: string[],
): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>();
  if (!reportIds.length) {
    return flags;
  }

  const { data, error } = await client
    .from("triage_shadow_comparisons")
    .select("report_id, has_disagreement, compared_at")
    .in("report_id", reportIds)
    .order("compared_at", { ascending: false });

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    const reportId = String(row.report_id ?? "");
    if (!reportId || flags.has(reportId)) {
      continue;
    }
    flags.set(reportId, Boolean(row.has_disagreement));
  }

  return flags;
}

export async function listReportIdsWithShadowDisagreement(
  client: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await client
    .from("triage_shadow_comparisons")
    .select("report_id, compared_at")
    .eq("has_disagreement", true)
    .order("compared_at", { ascending: false });

  if (error) {
    throw error;
  }

  const seen = new Set<string>();
  const reportIds: string[] = [];
  for (const row of data ?? []) {
    const reportId = String(row.report_id ?? "");
    if (!reportId || seen.has(reportId)) {
      continue;
    }
    seen.add(reportId);
    reportIds.push(reportId);
  }

  return reportIds;
}
