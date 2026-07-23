import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type {
  DashboardSearchParams,
  ReportRow,
  SummaryMetrics,
} from "@/components/reports/types";
import {
  fetchLatestShadowComparison,
  fetchShadowDisagreementFlags,
  listReportIdsWithShadowDisagreement,
  type ShadowComparisonRow,
} from "@/server/evals/shadow-service";
import { HttpError } from "@/server/http/errors";
import type { ReportFilters } from "@/server/officer/filters";
import { SORT_COLUMNS, validateReportFilters } from "@/server/officer/filters";
import {
  getOfficerReport,
  getOfficerStatusHistory,
  getReportsSummary,
  listRecentReports,
  type OfficerReport,
  type OfficerStatusHistoryItem,
} from "@/server/repositories/reports";
import { parseRecentListOptions } from "@/server/services/officer-read";

export type DashboardFetchBundle = {
  rows: ReportRow[];
  nextCursor: string | null;
  metrics: SummaryMetrics | null;
  error: string | null;
};

async function resolveShadowReportFilters(
  filters: ReportFilters,
): Promise<ReportFilters> {
  if (!filters.shadow_disagreement) {
    return filters;
  }

  const admin = getAdminClient();
  const reportIds = await listReportIdsWithShadowDisagreement(admin);
  return {
    ...filters,
    restrict_report_ids: reportIds,
  };
}

async function enrichOfficerReportsWithShadowFlags(
  reports: OfficerReport[],
): Promise<OfficerReport[]> {
  if (!reports.length) {
    return reports;
  }

  const admin = getAdminClient();
  const flags = await fetchShadowDisagreementFlags(
    admin,
    reports.map((report) => report.report_id),
  );

  return reports.map((report) => ({
    ...report,
    has_shadow_disagreement: flags.get(report.report_id) ?? false,
  }));
}

function toReportRow(report: OfficerReport): ReportRow {
  const triageComplete = report.triage_status === "completed";
  return {
    report_id: report.report_id,
    created_at: report.created_at,
    category: triageComplete ? (report.category ?? "") : "",
    priority: triageComplete ? (report.priority ?? "") : "",
    status: report.status,
    triage_status: report.triage_status,
    routing_destination: report.routing_destination ?? null,
    has_shadow_disagreement: report.has_shadow_disagreement ?? false,
    severity: triageComplete ? (report.severity ?? null) : null,
    confidence: triageComplete ? (report.confidence ?? null) : null,
    summary: triageComplete ? (report.summary ?? "") : "",
    evidence_path: report.evidence_path ?? null,
  };
}

function searchParamsFromDashboard(
  params: DashboardSearchParams,
  options: { includeCursor?: boolean },
): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set("limit", params.limit ?? "25");
  qs.set("sort", params.sort ?? "triage_bucket");
  qs.set("order", params.order ?? "asc");
  for (const key of [
    "status",
    "category",
    "priority",
    "min_severity",
    "max_severity",
    "created_after",
    "created_before",
    "triage_status",
    "routing_destination",
    "shadow_disagreement",
  ] as const) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) {
      qs.set(key, value.trim());
    }
  }
  if (params.bbox?.trim()) qs.set("bbox", params.bbox.trim());
  if (options.includeCursor !== false && params.cursor?.trim()) {
    qs.set("cursor", params.cursor.trim());
  }
  return qs;
}

export async function loadDashboardBundle(
  params: DashboardSearchParams,
  isMapView: boolean,
): Promise<DashboardFetchBundle> {
  const client = await createClient();
  const summaryParams = searchParamsFromDashboard(params, { includeCursor: false });
  const baseFilters = parseRecentListOptions(summaryParams).filters;

  try {
    validateReportFilters(baseFilters);
    const filters = await resolveShadowReportFilters(baseFilters);
    if (isMapView) {
      const metrics = await getReportsSummary(
        client,
        filters,
        summaryParams.get("bbox"),
      );
      return {
        rows: [],
        nextCursor: null,
        metrics,
        error: null,
      };
    }

    const listParams = searchParamsFromDashboard(params, { includeCursor: true });
    const listOptions = parseRecentListOptions(listParams);
    if (!(listOptions.sort in SORT_COLUMNS)) {
      return { rows: [], nextCursor: null, metrics: null, error: "load" };
    }

    const resolvedListFilters = await resolveShadowReportFilters(listOptions.filters);

    const [{ items, nextCursor }, metrics] = await Promise.all([
      listRecentReports(client, {
        limit: listOptions.limit,
        sort: listOptions.sort,
        order: listOptions.order,
        cursor: listOptions.cursor,
        filters: resolvedListFilters,
      }),
      getReportsSummary(client, resolvedListFilters, summaryParams.get("bbox")),
    ]);

    const enriched = await enrichOfficerReportsWithShadowFlags(items);

    return {
      rows: enriched.map(toReportRow),
      nextCursor,
      metrics,
      error: null,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      return { rows: [], nextCursor: null, metrics: null, error: "load" };
    }
    return { rows: [], nextCursor: null, metrics: null, error: "api" };
  }
}

export async function loadOfficerReportDetail(reportId: string): Promise<{
  report: OfficerReport | null;
  history: OfficerStatusHistoryItem[];
  shadowComparison: ShadowComparisonRow | null;
  error: "not_found" | "load_error" | "api_error" | null;
}> {
  const client = await createClient();
  try {
    const report = await getOfficerReport(client, reportId);
    if (!report) {
      return { report: null, history: [], shadowComparison: null, error: "not_found" };
    }
    const [history, shadowComparison] = await Promise.all([
      getOfficerStatusHistory(client, reportId),
      fetchLatestShadowComparison(getAdminClient(), reportId),
    ]);
    return {
      report: {
        ...report,
        has_shadow_disagreement: shadowComparison?.has_disagreement ?? false,
      },
      history,
      shadowComparison,
      error: null,
    };
  } catch {
    return {
      report: null,
      history: [],
      shadowComparison: null,
      error: "api_error",
    };
  }
}
