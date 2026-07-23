export const SLA_HOURS_BY_PRIORITY = {
  critical: 24,
  high: 48,
  medium: 72,
  low: 120,
} as const;

export const DEFAULT_SLA_HOURS = 72;

export type OperationalSummaryRow = {
  triage_status: string | null;
  priority: string | null;
  current_status: string | null;
  created_at: string | null;
  triaged_at: string | null;
};

export type OperationalMetrics = {
  needs_review_reports: number;
  critical_reports: number;
  sla_overdue_reports: number;
  ai_failed_reports: number;
  avg_triage_seconds: number | null;
};

function slaHoursForPriority(priority: string | null | undefined): number {
  if (!priority) return DEFAULT_SLA_HOURS;
  return (
    SLA_HOURS_BY_PRIORITY[priority as keyof typeof SLA_HOURS_BY_PRIORITY] ??
    DEFAULT_SLA_HOURS
  );
}

export function isReportSlaOverdue(
  row: OperationalSummaryRow,
  nowMs: number = Date.now(),
): boolean {
  const status = row.current_status ?? "";
  if (status === "resolved" || status === "rejected") return false;
  if (!row.created_at) return false;
  const created = Date.parse(row.created_at);
  if (!Number.isFinite(created)) return false;
  const limitMs = slaHoursForPriority(row.priority) * 60 * 60 * 1000;
  return nowMs - created > limitMs;
}

export function computeOperationalMetrics(
  rows: OperationalSummaryRow[],
  nowMs: number = Date.now(),
): OperationalMetrics {
  let needsReview = 0;
  let critical = 0;
  let slaOverdue = 0;
  let aiFailed = 0;
  const triageDurations: number[] = [];

  for (const row of rows) {
    const triageStatus = row.triage_status ?? "";
    const status = row.current_status ?? "";
    const isClosed = status === "resolved" || status === "rejected";

    if (triageStatus === "manual_review") needsReview += 1;
    if (triageStatus === "failed") aiFailed += 1;
    if (row.priority === "critical" && !isClosed) critical += 1;
    if (!isClosed && isReportSlaOverdue(row, nowMs)) slaOverdue += 1;

    if (row.triaged_at && row.created_at) {
      const start = Date.parse(row.created_at);
      const end = Date.parse(row.triaged_at);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        triageDurations.push((end - start) / 1000);
      }
    }
  }

  const avgTriageSeconds =
    triageDurations.length > 0
      ? Math.round(
          triageDurations.reduce((sum, value) => sum + value, 0) /
            triageDurations.length,
        )
      : null;

  return {
    needs_review_reports: needsReview,
    critical_reports: critical,
    sla_overdue_reports: slaOverdue,
    ai_failed_reports: aiFailed,
    avg_triage_seconds: avgTriageSeconds,
  };
}

export function formatTriageDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86_400).toFixed(1)}d`;
}
