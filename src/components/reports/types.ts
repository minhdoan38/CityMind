import { resolveSeverityPresetKey } from "@/lib/severity-filter-presets";

export type ReportRow = {
  report_id: string;
  created_at: string;
  category: string;
  priority: string;
  status: string;
  triage_status: string;
  routing_destination?: string | null;
  has_shadow_disagreement?: boolean;
  severity?: number | null;
  confidence?: number | null;
  summary: string;
  evidence_path?: string | null;
};

export type VolumeDayCount = {
  day: string;
  count: number;
};

export type StatusWorkloadCount = {
  status: "new" | "reviewing" | "resolved" | "rejected";
  count: number;
};

export type CategoryWorkloadCount = {
  category: string;
  count: number;
};

export type DayOfWeekKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type DayOfWeekCount = {
  day: DayOfWeekKey;
  count: number;
};

export type SummaryMetrics = {
  total_reports: number;
  needs_review_reports: number;
  critical_reports: number;
  sla_overdue_reports: number;
  ai_failed_reports: number;
  avg_triage_seconds: number | null;
  resolved_reports?: number;
  resolution_rate?: number;
  volume_7d?: VolumeDayCount[];
  workload_by_status?: StatusWorkloadCount[];
  top_categories?: CategoryWorkloadCount[];
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
  triage_status?: string;
  routing_destination?: string;
  shadow_disagreement?: string;
  view?: string;
  bbox?: string;
};

export type GeoPin = {
  report_id: string;
  latitude: number;
  longitude: number;
  priority: string;
  status: string;
  category: string;
  created_at: string;
};

export type Bbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export const FILTER_PARAM_KEYS = [
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
] as const;

function isActiveRoutingFilter(value: string | undefined): boolean {
  const routing = value?.trim();
  return routing === "government_default" || routing === "self_help";
}

function isActiveSeverityFilter(
  min: string | undefined,
  max: string | undefined,
): boolean {
  if (!min?.trim() && !max?.trim()) return false;
  const key = resolveSeverityPresetKey(min, max);
  if (key === "any") return false;
  return true;
}

/** Counts logical filter dimensions currently applied (excludes pagination/sort). */
export function countActiveFilters(params: DashboardSearchParams): number {
  let count = 0;

  if (params.triage_status?.trim()) count += 1;
  if (isActiveRoutingFilter(params.routing_destination)) count += 1;
  if (params.status?.trim()) count += 1;
  if (params.category?.trim()) count += 1;
  if (params.priority?.trim()) count += 1;
  if (params.shadow_disagreement?.trim()) count += 1;
  if (isActiveSeverityFilter(params.min_severity, params.max_severity)) count += 1;
  if (params.created_after?.trim() || params.created_before?.trim()) count += 1;

  return count;
}

export function hasActiveFilters(params: DashboardSearchParams): boolean {
  return countActiveFilters(params) > 0;
}

export function parseBbox(value: string | undefined): Bbox | null {
  if (!value?.trim()) return null;
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((num) => Number.isNaN(num))) return null;
  const [west, south, east, north] = nums;
  if (west >= east || south >= north) return null;
  if (south < -90 || south > 90 || north < -90 || north > 90) return null;
  if (west < -180 || west > 180 || east < -180 || east > 180) return null;
  return { west, south, east, north };
}

export function formatBbox(bbox: Bbox): string {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
}

export function buildReportsQuery(
  params: DashboardSearchParams,
  opts?: { includeCursor?: boolean },
): string {
  const qs = new URLSearchParams();
  const limit = params.limit ?? "25";
  qs.set("limit", limit);
  const sort = params.sort ?? "triage_bucket";
  const order = params.order ?? "asc";
  qs.set("sort", sort);
  qs.set("order", order);

  for (const key of FILTER_PARAM_KEYS) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) {
      qs.set(key, value.trim());
    }
  }

  if (params.view?.trim() && params.view !== "table") {
    qs.set("view", params.view.trim());
  }

  if (params.bbox?.trim()) {
    qs.set("bbox", params.bbox.trim());
  }

  if (opts?.includeCursor !== false && params.cursor?.trim()) {
    qs.set("cursor", params.cursor.trim());
  }

  return qs.toString();
}

export function buildGeoPinsQuery(
  viewport: Bbox,
  params: DashboardSearchParams,
): string {
  const qs = new URLSearchParams();
  qs.set("west", String(viewport.west));
  qs.set("south", String(viewport.south));
  qs.set("east", String(viewport.east));
  qs.set("north", String(viewport.north));

  const filterBbox = parseBbox(params.bbox);
  if (filterBbox) {
    qs.set("filter_bbox", formatBbox(filterBbox));
  }

  for (const key of FILTER_PARAM_KEYS) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) {
      qs.set(key, value.trim());
    }
  }

  return qs.toString();
}
