import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/server/config/env";
import { redactSensitiveText } from "@/server/ai/openai-compatible";
import type { HanoiAnalysis } from "@/server/domain/hanoi-analysis";
import type { PolicyViolation } from "@/server/validation/hanoi-policy";
import { HANOI_PROMPT_VERSION } from "./config";

export type AttemptRecordInput = {
  reportId: string;
  runId: string | null;
  attemptNumber: number;
  model: string | null;
  rawOutput: string;
  latencyMs: number;
  validationErrors: PolicyViolation[];
  disposition: string;
  analysis?: HanoiAnalysis | Record<string, unknown> | null;
  finishRun?: boolean;
};

export async function startTriageRun(
  client: SupabaseClient,
  reportId: string,
): Promise<string> {
  const { data, error } = await client
    .from("triage_runs")
    .insert({
      report_id: reportId,
      prompt_version: HANOI_PROMPT_VERSION,
    })
    .select("run_id")
    .single();

  if (error) {
    throw error;
  }

  return String(data.run_id);
}

export async function recordTriageAttempt(
  client: SupabaseClient,
  input: AttemptRecordInput,
): Promise<string> {
  const env = getServerEnv();
  const redactedOutput = redactSensitiveText(input.rawOutput, env);

  const { data, error } = await client.rpc("complete_triage_report", {
    p_report_id: input.reportId,
    p_analysis: input.analysis ?? null,
    p_disposition: input.disposition,
    p_run_id: input.runId,
    p_attempt_number: input.attemptNumber,
    p_model: input.model,
    p_prompt_version: HANOI_PROMPT_VERSION,
    p_raw_output: redactedOutput,
    p_latency_ms: input.latencyMs,
    p_validation_errors: input.validationErrors,
    p_finish_run: input.finishRun ?? false,
  });

  if (error) {
    throw error;
  }

  const payload = (data ?? {}) as { run_id?: string };
  return String(payload.run_id ?? input.runId ?? "");
}

export async function finishTriageRun(
  client: SupabaseClient,
  runId: string,
  finalDisposition: string,
): Promise<void> {
  const { error } = await client
    .from("triage_runs")
    .update({
      finished_at: new Date().toISOString(),
      final_disposition: finalDisposition,
    })
    .eq("run_id", runId);

  if (error) {
    throw error;
  }
}
