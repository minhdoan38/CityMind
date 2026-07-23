import {
  isReportSlaOverdue,
  SLA_HOURS_BY_PRIORITY,
  DEFAULT_SLA_HOURS,
} from "@/lib/dashboard-operational-metrics";
import { resolveDashboardDateLocale } from "@/lib/dashboard-datetime";

export type SlaUrgency = "closed" | "ok" | "due" | "overdue";

export type ReportUrgencyInput = {
  created_at: string;
  priority: string;
  status: string;
  severity?: number | null;
  confidence?: number | null;
};

function slaHoursForPriority(priority: string | null | undefined): number {
  if (!priority) return DEFAULT_SLA_HOURS;
  return (
    SLA_HOURS_BY_PRIORITY[priority as keyof typeof SLA_HOURS_BY_PRIORITY] ??
    DEFAULT_SLA_HOURS
  );
}

export function isReportClosed(status: string): boolean {
  return status === "resolved" || status === "rejected";
}

export function getSlaUrgency(
  row: Pick<ReportUrgencyInput, "created_at" | "priority" | "status">,
  nowMs: number = Date.now(),
): SlaUrgency {
  if (isReportClosed(row.status)) return "closed";
  if (
    isReportSlaOverdue(
      {
        created_at: row.created_at,
        priority: row.priority,
        current_status: row.status,
        triage_status: null,
        triaged_at: null,
      },
      nowMs,
    )
  ) {
    return "overdue";
  }
  const created = Date.parse(row.created_at);
  if (!Number.isFinite(created)) return "ok";
  const limitMs = slaHoursForPriority(row.priority) * 60 * 60 * 1000;
  const ageMs = nowMs - created;
  if (ageMs >= limitMs * 0.75) return "due";
  return "ok";
}

export function formatReportAge(iso: string, locale: string): string {
  const created = Date.parse(iso);
  if (!Number.isFinite(created)) return iso;
  const deltaSec = Math.round((created - Date.now()) / 1000);
  const absSec = Math.abs(deltaSec);
  const rtf = new Intl.RelativeTimeFormat(resolveDashboardDateLocale(locale), {
    numeric: "auto",
  });

  if (absSec < 60) return rtf.format(deltaSec, "second");
  const deltaMin = Math.round(deltaSec / 60);
  if (Math.abs(deltaMin) < 60) return rtf.format(deltaMin, "minute");
  const deltaHour = Math.round(deltaMin / 60);
  if (Math.abs(deltaHour) < 48) return rtf.format(deltaHour, "hour");
  const deltaDay = Math.round(deltaHour / 24);
  return rtf.format(deltaDay, "day");
}

export function confidenceBand(
  confidence: number | null | undefined,
): "low" | "medium" | "high" | null {
  if (confidence == null || Number.isNaN(confidence)) return null;
  if (confidence < 0.34) return "low";
  if (confidence < 0.67) return "medium";
  return "high";
}

export function severityTone(
  severity: number | null | undefined,
): "idle" | "low" | "mid" | "high" | "critical" {
  if (severity == null || Number.isNaN(severity)) return "idle";
  if (severity >= 5) return "critical";
  if (severity >= 4) return "high";
  if (severity >= 3) return "mid";
  if (severity >= 1) return "low";
  return "idle";
}

export function priorityTone(
  priority: string | null | undefined,
): "critical" | "high" | "medium" | "low" | "unknown" {
  switch (priority?.toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return "unknown";
  }
}

export function reportRowSurfaceTone(
  report: ReportUrgencyInput,
  nowMs: number = Date.now(),
): "neutral" | "elevated" | "urgent" {
  if (isReportClosed(report.status)) return "neutral";
  const sla = getSlaUrgency(report, nowMs);
  if (sla === "overdue") return "urgent";
  if (
    report.priority === "critical" ||
    severityTone(report.severity) === "critical" ||
    sla === "due"
  ) {
    return "elevated";
  }
  return "neutral";
}
