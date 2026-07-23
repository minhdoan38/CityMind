import type { SupabaseClient } from "@supabase/supabase-js";

import type { DayOfWeekKey } from "@/components/reports/types";
import type { ReportAnalysis } from "../domain/report-analysis";
import { decodeCursor, encodeCursor } from "../officer/cursor";
import {
  coordsInBbox,
  SORT_COLUMNS,
  type ReportFilters,
  type SortColumn,
} from "../officer/filters";
import type { AccessTokenRow } from "../security/access-tokens";

export type CitizenStatusHistoryItem = {
  status: string;
  note: string | null;
  created_at: string;
};

export type CitizenStatusRawPayload = {
  report_id: string;
  received_at: string;
  triage_status: string;
  status: string;
  category: string | null;
  severity: number | null;
  priority: string | null;
  summary: string | null;
  recommendation: string | null;
  routing_destination: string | null;
  description?: string | null;
  handling_type?: number | null;
  guidance_code?: string | null;
  severity_label?: string | null;
  critical_alert?: boolean | null;
  allowed_actions?: unknown;
  prohibited_actions?: unknown;
  history: CitizenStatusHistoryItem[];
};

/** @deprecated Use CitizenStatusRawPayload + projectCitizenTriageView */
export type CitizenStatusPayload = {
  status: string;
  summary: string | null;
  history: CitizenStatusHistoryItem[];
};

const CITIZEN_HISTORY_KEYS = new Set(["status", "note", "created_at"]);

export async function getAccessTokenByHash(
  client: SupabaseClient,
  tokenHash: string,
): Promise<AccessTokenRow | null> {
  const { data, error } = await client
    .from("access_tokens")
    .select("token_hash, report_id, expires_at")
    .eq("token_hash", tokenHash)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data as AccessTokenRow | null) ?? null;
}

export async function getCitizenStatus(
  client: SupabaseClient,
  reportId: string,
): Promise<CitizenStatusRawPayload | null> {
  const { data: reportRow, error: reportError } = await client
    .from("reports")
    .select(
      "report_id, created_at, triage_status, current_status, category, severity, priority, summary, recommendation, routing_destination, description, handling_type, guidance_code, severity_label, critical_alert, allowed_actions, prohibited_actions",
    )
    .eq("report_id", reportId)
    .limit(1)
    .maybeSingle();

  if (reportError) {
    throw reportError;
  }
  if (!reportRow) {
    return null;
  }

  const { data: events, error: eventsError } = await client
    .from("status_events")
    .select("status, note, created_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });

  if (eventsError) {
    throw eventsError;
  }

  const history = (events ?? []).map((event) => projectCitizenHistoryItem(event));
  return {
    report_id: String(reportRow.report_id ?? reportId),
    received_at: String(reportRow.created_at ?? ""),
    triage_status: String(reportRow.triage_status ?? "pending"),
    status: (reportRow.current_status as string | null) ?? "new",
    category: (reportRow.category as string | null | undefined) ?? null,
    severity: (reportRow.severity as number | null | undefined) ?? null,
    priority: (reportRow.priority as string | null | undefined) ?? null,
    summary: (reportRow.summary as string | null | undefined) ?? null,
    recommendation: (reportRow.recommendation as string | null | undefined) ?? null,
    routing_destination:
      (reportRow.routing_destination as string | null | undefined) ?? null,
    description: (reportRow.description as string | null | undefined) ?? null,
    handling_type: (reportRow.handling_type as number | null | undefined) ?? null,
    guidance_code: (reportRow.guidance_code as string | null | undefined) ?? null,
    severity_label: (reportRow.severity_label as string | null | undefined) ?? null,
    critical_alert: (reportRow.critical_alert as boolean | null | undefined) ?? null,
    allowed_actions: reportRow.allowed_actions,
    prohibited_actions: reportRow.prohibited_actions,
    history,
  };
}

export function projectCitizenHistoryItem(
  event: Record<string, unknown>,
): CitizenStatusHistoryItem {
  const projected: CitizenStatusHistoryItem = {
    status: String(event.status ?? ""),
    note: event.note == null ? null : String(event.note),
    created_at: String(event.created_at ?? ""),
  };

  for (const key of Object.keys(projected)) {
    if (!CITIZEN_HISTORY_KEYS.has(key)) {
      throw new Error(`Citizen history projection leaked field: ${key}`);
    }
  }

  return projected;
}

export type CreateReportWithTokenParams = {
  reportId: string;
  tokenHash: string;
  tokenExpiresAt: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  analysis: ReportAnalysis;
  urbanContext?: unknown | null;
  evidencePath?: string | null;
};

export type CreateIntakeReportParams = {
  reportId: string;
  tokenHash: string;
  tokenExpiresAt: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  evidencePath?: string | null;
};

export async function createIntakeReportWithAccessToken(
  client: SupabaseClient,
  params: CreateIntakeReportParams,
): Promise<void> {
  const { error } = await client.rpc("create_intake_report_with_access_token", {
    p_report_id: params.reportId,
    p_token_hash: params.tokenHash,
    p_token_expires_at: params.tokenExpiresAt,
    p_description: params.description,
    p_latitude: params.latitude,
    p_longitude: params.longitude,
    p_evidence_path: params.evidencePath ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function createReportWithAccessToken(
  client: SupabaseClient,
  params: CreateReportWithTokenParams,
): Promise<void> {
  const { error } = await client.rpc("create_report_with_access_token", {
    p_report_id: params.reportId,
    p_token_hash: params.tokenHash,
    p_token_expires_at: params.tokenExpiresAt,
    p_description: params.description,
    p_latitude: params.latitude,
    p_longitude: params.longitude,
    p_category: params.analysis.category,
    p_severity: params.analysis.severity,
    p_confidence: params.analysis.confidence,
    p_summary: params.analysis.summary,
    p_recommendation: params.analysis.recommendation,
    p_priority: params.analysis.priority,
    p_estimated_impact: params.analysis.estimated_impact,
    p_evidence: params.analysis.evidence,
    p_uncertainty: params.analysis.uncertainty,
    p_urban_context: params.urbanContext ?? null,
    p_evidence_path: params.evidencePath ?? null,
  });

  if (error) {
    throw error;
  }
}

export function projectCitizenStatusPayload(
  payload: CitizenStatusPayload,
): CitizenStatusPayload {
  return {
    status: payload.status,
    summary: payload.summary,
    history: payload.history.map((item) => ({
      status: item.status,
      note: item.note,
      created_at: item.created_at,
    })),
  };
}

// --- Officer read paths (user-scoped Supabase client; never admin client) ---

export type OfficerReport = {
  report_id: string;
  created_at: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  severity?: number | null;
  confidence?: number | null;
  summary?: string | null;
  recommendation?: string | null;
  priority?: string | null;
  estimated_impact?: string | null;
  evidence?: string[];
  uncertainty?: string[];
  urban_context?: unknown;
  evidence_path?: string | null;
  triage_status: string;
  status: string;
  routing_destination?: string | null;
  has_shadow_disagreement?: boolean;
  status_note?: string | null;
  status_updated_at?: string | null;
};

export type OfficerStatusHistoryItem = {
  status: string;
  note?: string | null;
  actor_id?: string | null;
  created_at: string;
};

export type OfficerSummary = {
  total_reports: number;
  critical_reports: number;
  avg_severity: number;
  top_category: string;
  resolved_reports: number;
  resolution_rate: number;
  reports_by_dow: Array<{ day: DayOfWeekKey; count: number }>;
};

export type OfficerGeoPin = {
  report_id: string;
  latitude: number;
  longitude: number;
  priority?: string | null;
  status?: string | null;
  category?: string | null;
  created_at?: string | null;
};

type StatusEventRow = {
  status?: string | null;
  note?: string | null;
  created_at?: string | null;
};

function latestStatusEvent(events: StatusEventRow[] | null | undefined): StatusEventRow | null {
  if (!events?.length) return null;
  return [...events].sort((left, right) =>
    String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")),
  )[0] ?? null;
}

export function mapOfficerReportRow(row: Record<string, unknown>): OfficerReport {
  const events = (row.status_events as StatusEventRow[] | undefined) ?? [];
  const latest = latestStatusEvent(events);
  const currentStatus =
    (row.current_status as string | null | undefined) ??
    latest?.status ??
    "new";

  return {
    report_id: String(row.report_id ?? ""),
    created_at: String(row.created_at ?? ""),
    description: (row.description as string | null | undefined) ?? null,
    latitude: (row.latitude as number | null | undefined) ?? null,
    longitude: (row.longitude as number | null | undefined) ?? null,
    category: (row.category as string | null | undefined) ?? null,
    severity: (row.severity as number | null | undefined) ?? null,
    confidence: (row.confidence as number | null | undefined) ?? null,
    summary: (row.summary as string | null | undefined) ?? null,
    recommendation: (row.recommendation as string | null | undefined) ?? null,
    priority: (row.priority as string | null | undefined) ?? null,
    estimated_impact: (row.estimated_impact as string | null | undefined) ?? null,
    evidence: Array.isArray(row.evidence) ? (row.evidence as string[]) : [],
    uncertainty: Array.isArray(row.uncertainty) ? (row.uncertainty as string[]) : [],
    urban_context: row.urban_context ?? null,
    evidence_path: (row.evidence_path as string | null | undefined) ?? null,
    triage_status: String(row.triage_status ?? "pending"),
    routing_destination: (row.routing_destination as string | null | undefined) ?? null,
    status: currentStatus,
    status_note: latest?.note ?? null,
  };
}

export function triageBucketRank(triageStatus: string): number {
  if (triageStatus === "manual_review" || triageStatus === "failed") return 0;
  if (triageStatus === "pending" || triageStatus === "processing") return 1;
  if (triageStatus === "completed") return 2;
  return 3;
}

export function compareTriageBucket(
  left: { triage_status: string; created_at: string },
  right: { triage_status: string; created_at: string },
): number {
  const bucketDiff =
    triageBucketRank(left.triage_status) - triageBucketRank(right.triage_status);
  if (bucketDiff !== 0) return bucketDiff;
  return String(left.created_at).localeCompare(String(right.created_at));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyReportFilters(query: any, filters: ReportFilters) {
  if (filters.status != null) query = query.eq("current_status", filters.status);
  if (filters.category != null) query = query.eq("category", filters.category);
  if (filters.priority != null) query = query.eq("priority", filters.priority);
  if (filters.triage_status?.length) {
    query = query.in("triage_status", filters.triage_status);
  }
  if (filters.restrict_report_ids?.length) {
    query = query.in("report_id", filters.restrict_report_ids);
  } else if (filters.restrict_report_ids) {
    query = query.eq("report_id", "__no_shadow_matches__");
  }
  const routingFilter = filters.routing_destination ?? "government_default";
  if (routingFilter === "government_default") {
    query = query.or("routing_destination.is.null,routing_destination.eq.government");
  } else if (routingFilter === "self_help") {
    query = query.eq("routing_destination", "self_help");
  }
  if (filters.min_severity != null) query = query.gte("severity", filters.min_severity);
  if (filters.max_severity != null) query = query.lte("severity", filters.max_severity);
  if (filters.created_after != null) query = query.gte("created_at", filters.created_after);
  if (filters.created_before != null) query = query.lte("created_at", filters.created_before);
  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyKeysetPagination(
  query: any,
  options: { sort: SortColumn; order: "asc" | "desc"; cursor?: string | null },
) {
  const column = SORT_COLUMNS[options.sort];
  const descending = options.order === "desc";
  query = query.order(column, { ascending: !descending }).order("report_id", {
    ascending: !descending,
  });

  if (!options.cursor) return query;

  const [cursorSort, cursorOrder, value, reportId] = decodeCursor(options.cursor);
  if (cursorSort !== options.sort || cursorOrder !== options.order) {
    throw new Error("Cursor does not match sort/order");
  }

  const comparator = descending ? "lt" : "gt";
  query = query.or(
    `${column}.${comparator}.${value},and(${column}.eq.${value},report_id.${comparator}.${reportId})`,
  );
  return query;
}

export async function listRecentReports(
  client: SupabaseClient,
  options: {
    limit: number;
    sort: SortColumn;
    order: "asc" | "desc";
    cursor?: string | null;
    filters: ReportFilters;
  },
): Promise<{ items: OfficerReport[]; nextCursor: string | null }> {
  if (options.sort === "triage_bucket") {
    let query = client
      .from("reports")
      .select("*, status_events(status, note, created_at)");
    query = applyReportFilters(query, options.filters);
    query = query.order("created_at", { ascending: true });
    const { data, error } = await query;
    if (error) throw error;

    const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      row,
      mapped: mapOfficerReportRow(row),
    }));
    rows.sort((left, right) =>
      compareTriageBucket(left.mapped, right.mapped),
    );

    const pageRows = rows.slice(0, options.limit);
    const items = pageRows.map((entry) => entry.mapped);
    const hasMore = rows.length > options.limit;
    return {
      items,
      nextCursor: hasMore ? "triage_bucket:more" : null,
    };
  }

  let query = client
    .from("reports")
    .select("*, status_events(status, note, created_at)");
  query = applyReportFilters(query, options.filters);
  query = applyKeysetPagination(query, {
    sort: options.sort,
    order: options.order,
    cursor: options.cursor,
  });
  query = query.limit(options.limit + 1);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Record<string, unknown>[];
  const hasMore = rows.length > options.limit;
  const pageRows = rows.slice(0, options.limit);
  const items = pageRows.map((row) => mapOfficerReportRow(row));

  let nextCursor: string | null = null;
  if (hasMore && pageRows.length > 0) {
    const last = pageRows[pageRows.length - 1]!;
    const column = SORT_COLUMNS[options.sort];
    let sortValue = last[column];
    if (options.sort === "status") {
      sortValue = last.current_status ?? items[items.length - 1]?.status;
    }
    nextCursor = encodeCursor(
      options.sort,
      options.order,
      String(sortValue ?? ""),
      String(last.report_id ?? ""),
    );
  }

  return { items, nextCursor };
}

export async function getReportsSummary(
  client: SupabaseClient,
  filters: ReportFilters,
  bbox?: string | null,
): Promise<OfficerSummary> {
  const empty: OfficerSummary = {
    total_reports: 0,
    critical_reports: 0,
    avg_severity: 0,
    top_category: "none",
    resolved_reports: 0,
    resolution_rate: 0,
    reports_by_dow: [
      { day: "sun", count: 0 },
      { day: "mon", count: 0 },
      { day: "tue", count: 0 },
      { day: "wed", count: 0 },
      { day: "thu", count: 0 },
      { day: "fri", count: 0 },
      { day: "sat", count: 0 },
    ],
  };

  let query = client
    .from("reports")
    .select("severity, priority, category, current_status, created_at, latitude, longitude");
  query = applyReportFilters(query, filters);
  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []) as Array<Record<string, unknown>>;
  if (bbox) {
    const parts = bbox.split(",").map((part) => Number(part.trim()));
    if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
      const [west, south, east, north] = parts;
      rows = rows.filter((row) =>
        coordsInBbox(
          row.latitude as number | null,
          row.longitude as number | null,
          west,
          south,
          east,
          north,
        ),
      );
    }
  }

  if (!rows.length) return empty;

  const totalReports = rows.length;
  const criticalReports = rows.filter((row) => row.priority === "critical").length;
  const avgSeverity = Number(
    (
      rows.reduce((sum, row) => sum + (Number(row.severity) || 0), 0) / totalReports
    ).toFixed(2),
  );
  const categories = rows
    .map((row) => row.category)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const categoryCounts = new Map<string, number>();
  for (const category of categories) {
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  const topCategory =
    [...categoryCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
    "none";

  const dowKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  let resolvedReports = 0;
  for (const row of rows) {
    if (row.current_status === "resolved") resolvedReports += 1;
    const created = row.created_at;
    if (!created) continue;
    const date = new Date(String(created).replace("Z", "+00:00"));
    if (Number.isNaN(date.getTime())) continue;
    dowCounts[(date.getDay() + 7) % 7] += 1;
  }

  return {
    total_reports: totalReports,
    critical_reports: criticalReports,
    avg_severity: avgSeverity,
    top_category: topCategory,
    resolved_reports: resolvedReports,
    resolution_rate: totalReports
      ? Math.round((resolvedReports / totalReports) * 100)
      : 0,
    reports_by_dow: dowKeys.map((day, index) => ({
      day,
      count: dowCounts[index] ?? 0,
    })),
  };
}

export async function getOfficerReport(
  client: SupabaseClient,
  reportId: string,
): Promise<OfficerReport | null> {
  const { data, error } = await client
    .from("reports")
    .select("*, status_events(status, note, created_at)")
    .eq("report_id", reportId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const mapped = mapOfficerReportRow(data as Record<string, unknown>);
  const events = (data as { status_events?: StatusEventRow[] }).status_events ?? [];
  const latest = latestStatusEvent(events);
  mapped.status_updated_at = latest?.created_at ?? null;
  return mapped;
}

export async function getOfficerStatusHistory(
  client: SupabaseClient,
  reportId: string,
): Promise<OfficerStatusHistoryItem[]> {
  const { data, error } = await client
    .from("status_events")
    .select("status, note, actor_id, created_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OfficerStatusHistoryItem[];
}

export async function getOfficerEvidenceReference(
  client: SupabaseClient,
  reportId: string,
): Promise<{ evidencePath: string | null } | null> {
  const { data, error } = await client
    .from("reports")
    .select("evidence_path")
    .eq("report_id", reportId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    evidencePath: (data.evidence_path as string | null | undefined) ?? null,
  };
}

/** @deprecated Prefer getOfficerEvidenceReference for dual-read support. */
export async function getOfficerImageUri(
  client: SupabaseClient,
  reportId: string,
): Promise<string | null> {
  const reference = await getOfficerEvidenceReference(client, reportId);
  if (!reference) return null;
  if (reference.evidencePath) {
    return `supabase://${reference.evidencePath}`;
  }
  return null;
}

export async function listGeoPins(
  client: SupabaseClient,
  options: {
    west: number;
    south: number;
    east: number;
    north: number;
    filterWest?: number | null;
    filterSouth?: number | null;
    filterEast?: number | null;
    filterNorth?: number | null;
    filters: ReportFilters;
    limit?: number;
  },
): Promise<{ pins: OfficerGeoPin[]; unlocatedCount: number }> {
  const { data, error } = await client.rpc("get_report_geo_pins", {
    p_west: options.west,
    p_south: options.south,
    p_east: options.east,
    p_north: options.north,
    p_filter_west: options.filterWest ?? null,
    p_filter_south: options.filterSouth ?? null,
    p_filter_east: options.filterEast ?? null,
    p_filter_north: options.filterNorth ?? null,
    p_status: options.filters.status ?? null,
    p_category: options.filters.category ?? null,
    p_priority: options.filters.priority ?? null,
    p_min_severity: options.filters.min_severity ?? null,
    p_max_severity: options.filters.max_severity ?? null,
    p_created_after: options.filters.created_after ?? null,
    p_created_before: options.filters.created_before ?? null,
  });

  if (error) throw error;

  let payload: Record<string, unknown> = {};
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    payload = data[0] as Record<string, unknown>;
  } else if (data && typeof data === "object") {
    payload = data as Record<string, unknown>;
  }

  let pins = payload.pins;
  if (typeof pins === "string") {
    pins = JSON.parse(pins) as unknown;
  }
  const normalized: OfficerGeoPin[] = [];
  if (Array.isArray(pins)) {
    const limit = options.limit ?? 5000;
    for (const pin of pins.slice(0, limit)) {
      if (!pin || typeof pin !== "object") continue;
      const row = pin as Record<string, unknown>;
      normalized.push({
        report_id: String(row.report_id ?? ""),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        priority: (row.priority as string | null | undefined) ?? null,
        status: (row.status as string | null | undefined) ?? null,
        category: (row.category as string | null | undefined) ?? null,
        created_at: (row.created_at as string | null | undefined) ?? null,
      });
    }
  }

  return {
    pins: normalized,
    unlocatedCount: Number(payload.unlocated_count ?? 0),
  };
}

export type UpdateReportStatusParams = {
  reportId: string;
  status: string;
  note: string | null;
  actorId: string;
};

export async function updateReportStatus(
  client: SupabaseClient,
  params: UpdateReportStatusParams,
): Promise<{ report_id: string; status: string; updated: boolean }> {
  const { data, error } = await client.rpc("update_report_with_status_event", {
    p_report_id: params.reportId,
    p_status: params.status,
    p_note: params.note,
    p_actor_id: params.actorId,
  });

  if (error) {
    throw error;
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    report_id: String(payload.report_id ?? params.reportId),
    status: String(payload.status ?? params.status),
    updated: Boolean(payload.updated ?? true),
  };
}

export async function escalateReportToGovernment(
  client: SupabaseClient,
  params: { reportId: string; tokenHash: string; reason?: string },
): Promise<{ routing_destination: "government"; updated: boolean }> {
  const { data, error } = await client.rpc("escalate_report_to_government", {
    p_report_id: params.reportId,
    p_token_hash: params.tokenHash,
    p_reason: params.reason ?? "citizen_escalated",
  });

  if (error) {
    throw error;
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    routing_destination: "government",
    updated: Boolean(payload.updated ?? true),
  };
}

export async function updateOfficerReportRouting(
  client: SupabaseClient,
  params: {
    reportId: string;
    routingDestination: "government";
    routingReason: string;
    note?: string | null;
    actorId?: string | null;
    currentStatus?: string | null;
  },
): Promise<void> {
  const { error: updateError } = await client
    .from("reports")
    .update({
      routing_destination: params.routingDestination,
      routing_reason: params.routingReason,
      routed_at: new Date().toISOString(),
    })
    .eq("report_id", params.reportId);

  if (updateError) {
    throw updateError;
  }

  if (params.note?.trim()) {
    const { error: eventError } = await client.from("status_events").insert({
      report_id: params.reportId,
      status: params.currentStatus ?? "new",
      note: params.note.trim(),
      actor_id: params.actorId ?? null,
    });
    if (eventError) {
      throw eventError;
    }
  }
}

export async function deleteOfficerReport(
  client: SupabaseClient,
  reportId: string,
): Promise<void> {
  const { error } = await client.from("reports").delete().eq("report_id", reportId);
  if (error) {
    throw error;
  }
}
