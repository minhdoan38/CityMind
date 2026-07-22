import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReportAnalysis } from "@/server/domain/report-analysis";
import { evaluateRoutingPolicy, ROUTING_POLICY_VERSION } from "./policy";

export type ApplyRoutingContext = {
  disposition: "completed" | "manual_review" | "failed";
  analysis?: ReportAnalysis | null;
};

export async function applyRoutingForReport(
  client: SupabaseClient,
  reportId: string,
  context: ApplyRoutingContext,
): Promise<void> {
  const triageStatus =
    context.disposition === "completed"
      ? "completed"
      : context.disposition === "manual_review"
        ? "manual_review"
        : "failed";

  const decision = evaluateRoutingPolicy({
    triageStatus,
    category: context.analysis?.category ?? null,
    severity: context.analysis?.severity ?? null,
    priority: context.analysis?.priority ?? null,
    confidence: context.analysis?.confidence ?? null,
  });

  const { error } = await client
    .from("reports")
    .update({
      routing_destination: decision.destination,
      routing_reason: decision.reasonCode,
      routing_policy_version: decision.policyVersion,
      routed_at: new Date().toISOString(),
    })
    .eq("report_id", reportId);

  if (error) {
    throw error;
  }
}

export { ROUTING_POLICY_VERSION };
