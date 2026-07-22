import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AnalyticsCategoryCount,
  AnalyticsHotspotRow,
  AnalyticsResponse,
  AnalyticsSlaBucket,
  AnalyticsSlaSummary,
  AnalyticsVolumePoint,
} from "@/components/analytics/types";

export const MAX_ANALYTICS_SPAN_DAYS = 366;
export const HOTSPOT_TOP_N = 10;
export const PUBLIC_STATS_WINDOW_DAYS = 30;
export const PUBLIC_STATS_TOP_N = 2;
export const PUBLIC_STATS_K_MIN = 3;

const SLA_BUCKETS: Array<{ label: string; max: number | null }> = [
  { label: "0-1", max: 1 },
  { label: "2-3", max: 3 },
  { label: "4-7", max: 7 },
  { label: "8-14", max: 14 },
  { label: "15+", max: null },
];

export type PublicCategoryStat = {
  category: string;
  count: number;
};

export type PublicStatsResponse = {
  total_last_30d: number;
  top_categories: PublicCategoryStat[];
};

type OfficerAnalyticsRpcRow = {
  volume: AnalyticsVolumePoint[];
  category_mix: AnalyticsCategoryCount[];
  hotspots: AnalyticsHotspotRow[];
  sla_days: number[];
};

export function validateAnalyticsRange(dateFrom: string, dateTo: string): void {
  if (dateFrom > dateTo) {
    throw new RangeError("Invalid date range: from cannot be after to");
  }
  const from = new Date(`${dateFrom}T00:00:00.000Z`);
  const to = new Date(`${dateTo}T00:00:00.000Z`);
  const spanDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000);
  if (spanDays > MAX_ANALYTICS_SPAN_DAYS) {
    throw new RangeError(
      `Date range cannot exceed ${MAX_ANALYTICS_SPAN_DAYS} days`,
    );
  }
}

export function buildSlaHistogram(days: number[]): AnalyticsSlaBucket[] {
  const counts = Object.fromEntries(SLA_BUCKETS.map((bucket) => [bucket.label, 0]));
  for (const value of days) {
    if (value <= 1) counts["0-1"] += 1;
    else if (value <= 3) counts["2-3"] += 1;
    else if (value <= 7) counts["4-7"] += 1;
    else if (value <= 14) counts["8-14"] += 1;
    else counts["15+"] += 1;
  }
  return SLA_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: counts[bucket.label],
  }));
}

export function buildSlaSummary(days: number[]): AnalyticsSlaSummary {
  if (days.length === 0) {
    return { closed_count: 0, median_days: null, avg_days: null, histogram: [] };
  }
  const sorted = [...days].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
      : sorted[midpoint];
  const avg =
    Math.round((days.reduce((sum, value) => sum + value, 0) / days.length) * 100) /
    100;
  return {
    closed_count: days.length,
    median_days: median,
    avg_days: avg,
    histogram: buildSlaHistogram(days),
  };
}

export function publicTopCategories(
  categoryMix: AnalyticsCategoryCount[],
): PublicCategoryStat[] {
  return categoryMix
    .filter((row) => row.report_count >= PUBLIC_STATS_K_MIN)
    .map((row) => ({ category: row.category, count: row.report_count }))
    .slice(0, PUBLIC_STATS_TOP_N);
}

function mapOfficerAnalyticsPayload(
  dateFrom: string,
  dateTo: string,
  payload: OfficerAnalyticsRpcRow,
): AnalyticsResponse {
  const volume = payload.volume ?? [];
  const categoryMix = payload.category_mix ?? [];
  const hotspots = payload.hotspots ?? [];
  const sla = buildSlaSummary(payload.sla_days ?? []);
  const empty =
    volume.length === 0 &&
    categoryMix.length === 0 &&
    sla.closed_count === 0 &&
    hotspots.length === 0;

  return {
    from: dateFrom,
    to: dateTo,
    empty,
    volume,
    category_mix: categoryMix,
    sla,
    hotspots,
  };
}

export async function fetchOfficerAnalytics(
  client: SupabaseClient,
  dateFrom: string,
  dateTo: string,
): Promise<AnalyticsResponse> {
  const { data, error } = await client.rpc("get_officer_analytics", {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  if (error) {
    throw new Error(`Analytics query failed: ${error.message}`);
  }
  return mapOfficerAnalyticsPayload(
    dateFrom,
    dateTo,
    (data ?? {
      volume: [],
      category_mix: [],
      hotspots: [],
      sla_days: [],
    }) as OfficerAnalyticsRpcRow,
  );
}

export async function fetchPublicStats(
  client: SupabaseClient,
): Promise<PublicStatsResponse> {
  const { data, error } = await client.rpc("get_public_stats");
  if (error) {
    throw new Error(`Public stats query failed: ${error.message}`);
  }
  const payload = (data ?? {
    total_last_30d: 0,
    top_categories: [],
  }) as PublicStatsResponse;
  return {
    total_last_30d: payload.total_last_30d ?? 0,
    top_categories: payload.top_categories ?? [],
  };
}
