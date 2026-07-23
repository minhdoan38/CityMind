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

export type SummaryInsightRow = {
  created_at: string | null;
  current_status: string | null;
  category: string | null;
};

const STATUS_ORDER: StatusWorkloadCount["status"][] = [
  "new",
  "reviewing",
  "resolved",
  "rejected",
];

function formatIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeStatus(value: string | null | undefined): StatusWorkloadCount["status"] {
  if (
    value === "reviewing" ||
    value === "resolved" ||
    value === "rejected"
  ) {
    return value;
  }
  return "new";
}

export function buildVolume7d(
  rows: SummaryInsightRow[],
  nowMs: number = Date.now(),
): VolumeDayCount[] {
  const buckets = new Map<string, number>();
  const anchor = new Date(nowMs);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(anchor);
    day.setUTCDate(day.getUTCDate() - offset);
    buckets.set(formatIsoDay(day), 0);
  }

  for (const row of rows) {
    if (!row.created_at) continue;
    const key = String(row.created_at).slice(0, 10);
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([day, count]) => ({ day, count }));
}

export function buildWorkloadByStatus(
  rows: SummaryInsightRow[],
): StatusWorkloadCount[] {
  const counts = new Map<StatusWorkloadCount["status"], number>();
  for (const status of STATUS_ORDER) counts.set(status, 0);

  for (const row of rows) {
    const status = normalizeStatus(row.current_status);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return STATUS_ORDER.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

export function buildTopCategories(
  rows: SummaryInsightRow[],
  limit = 5,
): CategoryWorkloadCount[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const category = row.category?.trim();
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([category, count]) => ({ category, count }));
}

export function computeSummaryInsights(
  rows: SummaryInsightRow[],
  nowMs: number = Date.now(),
) {
  return {
    volume_7d: buildVolume7d(rows, nowMs),
    workload_by_status: buildWorkloadByStatus(rows),
    top_categories: buildTopCategories(rows),
  };
}
