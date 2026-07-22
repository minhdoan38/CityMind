import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  DashboardSearchParams,
  ReportRow,
  SummaryMetrics,
} from "@/components/reports/types";
import { HttpError } from "@/server/http/errors";
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

function toReportRow(report: OfficerReport): ReportRow {
  const triageComplete = report.triage_status === "completed";
  return {
    report_id: report.report_id,
    created_at: report.created_at,
    category: triageComplete ? (report.category ?? "") : "",
    priority: triageComplete ? (report.priority ?? "") : "",
    status: report.status,
    triage_status: report.triage_status,
    severity: triageComplete ? (report.severity ?? null) : null,
    summary: triageComplete ? (report.summary ?? "") : "",
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
  const filters = parseRecentListOptions(summaryParams).filters;

  try {
    validateReportFilters(filters);
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

    const [{ items, nextCursor }, metrics] = await Promise.all([
      listRecentReports(client, {
        limit: listOptions.limit,
        sort: listOptions.sort,
        order: listOptions.order,
        cursor: listOptions.cursor,
        filters: listOptions.filters,
      }),
      getReportsSummary(client, listOptions.filters, summaryParams.get("bbox")),
    ]);

    return {
      rows: items.map(toReportRow),
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
  error: "not_found" | "load_error" | "api_error" | null;
}> {
  const client = await createClient();
  try {
    const report = await getOfficerReport(client, reportId);
    if (!report) {
      return { report: null, history: [], error: "not_found" };
    }
    const history = await getOfficerStatusHistory(client, reportId);
    return { report, history, error: null };
  } catch {
    return { report: null, history: [], error: "api_error" };
  }
}
