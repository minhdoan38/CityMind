export type ReportRow = {
  report_id: string;
  created_at: string;
  category: string;
  priority: string;
  status: string;
  severity?: number | null;
  summary: string;
};

export type SummaryMetrics = {
  total_reports: number;
  critical_reports: number;
  avg_severity: number | null;
  top_category: string | null;
};

export type DashboardSearchParams = {
  cursor?: string;
  limit?: string;
  sort?: string;
  order?: string;
  status?: string;
  category?: string;
  priority?: string;
  min_severity?: string;
  max_severity?: string;
  created_after?: string;
  created_before?: string;
};

export const FILTER_PARAM_KEYS = [
  "status",
  "category",
  "priority",
  "min_severity",
  "max_severity",
  "created_after",
  "created_before",
] as const;

export function hasActiveFilters(params: DashboardSearchParams): boolean {
  return FILTER_PARAM_KEYS.some((key) => {
    const value = params[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function buildReportsQuery(
  params: DashboardSearchParams,
  opts?: { includeCursor?: boolean },
): string {
  const qs = new URLSearchParams();
  const limit = params.limit ?? "25";
  qs.set("limit", limit);
  const sort = params.sort ?? "created_at";
  const order = params.order ?? "desc";
  qs.set("sort", sort);
  qs.set("order", order);

  for (const key of FILTER_PARAM_KEYS) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) {
      qs.set(key, value.trim());
    }
  }

  if (opts?.includeCursor !== false && params.cursor?.trim()) {
    qs.set("cursor", params.cursor.trim());
  }

  return qs.toString();
}
