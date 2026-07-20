export const ANALYTICS_URL_KEYS = ["range", "from", "to"] as const;

export type AnalyticsSearchParams = {
  range?: string;
  from?: string;
  to?: string;
};

export type AnalyticsVolumePoint = {
  day: string;
  report_count: number;
};

export type AnalyticsCategoryCount = {
  category: string;
  report_count: number;
};

export type AnalyticsSlaBucket = {
  label: string;
  count: number;
};

export type AnalyticsSlaSummary = {
  closed_count: number;
  median_days: number | null;
  avg_days: number | null;
  histogram: AnalyticsSlaBucket[];
};

export type AnalyticsHotspotRow = {
  category: string;
  report_count: number;
};

export type AnalyticsResponse = {
  from: string;
  to: string;
  empty: boolean;
  volume: AnalyticsVolumePoint[];
  category_mix: AnalyticsCategoryCount[];
  sla: AnalyticsSlaSummary;
  hotspots: AnalyticsHotspotRow[];
};

export type ResolvedAnalyticsRange = {
  range: string;
  from: string;
  to: string;
  valid: boolean;
};

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function resolveAnalyticsRange(
  params: AnalyticsSearchParams,
): ResolvedAnalyticsRange {
  const today = new Date();
  const defaultTo = formatIsoDate(today);
  const range = params.range?.trim() || "30";

  if (range === "custom") {
    const from = params.from?.trim() ?? "";
    const to = params.to?.trim() || defaultTo;
    const valid = Boolean(from && to && from <= to);
    return { range, from, to, valid };
  }

  const presetDays = range === "7" ? 7 : range === "90" ? 90 : 30;
  const from = formatIsoDate(addUtcDays(today, -(presetDays - 1)));
  return { range, from, to: defaultTo, valid: true };
}

export function bucketCategories(
  items: AnalyticsCategoryCount[],
  otherLabel: string,
): AnalyticsCategoryCount[] {
  const sorted = [...items].sort((a, b) => b.report_count - a.report_count);
  if (sorted.length <= 6) {
    return sorted;
  }
  const top = sorted.slice(0, 5);
  const otherCount = sorted
    .slice(5)
    .reduce((sum, row) => sum + row.report_count, 0);
  return [...top, { category: otherLabel, report_count: otherCount }];
}
