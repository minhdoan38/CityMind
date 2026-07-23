import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { HanoiSeverity } from "@/server/domain/hanoi-analysis";
import {
  resolveGuidanceScript,
  type GuidanceResolution,
} from "@/server/domain/guidance-resolver";
import type { ReportAnalysis } from "@/server/domain/report-analysis";
import {
  evaluateRoutingPolicy,
  ROUTING_POLICY_VERSION,
  type GuidanceStatus,
} from "./policy";

export type ApplyRoutingContext = {
  disposition: "completed" | "manual_review" | "failed";
  analysis?: ReportAnalysis | null;
};

type ReportRoutingRow = {
  category: string | null;
  severity: number | null;
  priority: string | null;
  confidence: number | null;
  handling_type: number | null;
  guidance_code: string | null;
  severity_label: string | null;
  critical_alert: boolean | null;
  description: string | null;
};

export function resolveGuidanceStatusForReport(row: {
  handling_type: number | null;
  guidance_code: string | null;
  severity_label: string | null;
  description: string | null;
}): GuidanceStatus | null {
  if (
    row.handling_type !== 1 &&
    row.handling_type !== 2 &&
    row.handling_type !== 3
  ) {
    return null;
  }
  if (!row.guidance_code || !row.severity_label) {
    return "generate_later";
  }

  const severity = row.severity_label as HanoiSeverity;
  const resolution: GuidanceResolution = resolveGuidanceScript({
    guidance_code: row.guidance_code,
    handling_type: row.handling_type,
    severity,
    report_text: row.description ?? "",
  });

  return resolution.status;
}

async function loadReportRoutingRow(
  client: SupabaseClient,
  reportId: string,
): Promise<ReportRoutingRow | null> {
  const { data, error } = await client
    .from("reports")
    .select(
      "category, severity, priority, confidence, handling_type, guidance_code, severity_label, critical_alert, description",
    )
    .eq("report_id", reportId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return {
    category: (data.category as string | null | undefined) ?? null,
    severity: (data.severity as number | null | undefined) ?? null,
    priority: (data.priority as string | null | undefined) ?? null,
    confidence: (data.confidence as number | null | undefined) ?? null,
    handling_type: (data.handling_type as number | null | undefined) ?? null,
    guidance_code: (data.guidance_code as string | null | undefined) ?? null,
    severity_label: (data.severity_label as string | null | undefined) ?? null,
    critical_alert: (data.critical_alert as boolean | null | undefined) ?? null,
    description: (data.description as string | null | undefined) ?? null,
  };
}

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

  const row = await loadReportRoutingRow(client, reportId);
  const handlingType =
    row?.handling_type === 1 || row?.handling_type === 2 || row?.handling_type === 3
      ? row.handling_type
      : null;

  const guidanceStatus =
    row && handlingType != null ? resolveGuidanceStatusForReport(row) : null;

  const decision = evaluateRoutingPolicy({
    triageStatus,
    category: row?.category ?? context.analysis?.category ?? null,
    severity: row?.severity ?? context.analysis?.severity ?? null,
    priority: row?.priority ?? context.analysis?.priority ?? null,
    confidence: row?.confidence ?? context.analysis?.confidence ?? null,
    handling_type: handlingType,
    guidance_status: guidanceStatus,
    critical_alert: row?.critical_alert ?? null,
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
