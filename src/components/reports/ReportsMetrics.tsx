import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  Bot,
  ClipboardList,
  Clock,
  Timer,
} from "lucide-react";

import { formatTriageDuration } from "@/lib/dashboard-operational-metrics";
import { cn } from "@/lib/utils";

import type { SummaryMetrics } from "./types";

type Props = {
  metrics: SummaryMetrics | null;
  compact?: boolean;
};

const METRIC_ICONS = [
  ClipboardList,
  AlertTriangle,
  Clock,
  Bot,
  Timer,
] as const;

const DELAY_CLASSES = [
  "dash-rise dash-rise-delay-1",
  "dash-rise dash-rise-delay-2",
  "dash-rise dash-rise-delay-3",
  "dash-rise dash-rise-delay-4",
  "dash-rise dash-rise-delay-5",
] as const;

export default async function ReportsMetrics({ metrics, compact = false }: Props) {
  const t = await getTranslations("dashboard");

  const cells = [
    {
      label: t("metricNeedsReview"),
      value: metrics ? String(metrics.needs_review_reports) : "—",
      accent: Boolean(metrics && metrics.needs_review_reports > 0),
    },
    {
      label: t("metricCritical"),
      value: metrics ? String(metrics.critical_reports) : "—",
      accent: Boolean(metrics && metrics.critical_reports > 0),
    },
    {
      label: t("metricSlaOverdue"),
      value: metrics ? String(metrics.sla_overdue_reports) : "—",
      accent: Boolean(metrics && metrics.sla_overdue_reports > 0),
    },
    {
      label: t("metricAiFailed"),
      value: metrics ? String(metrics.ai_failed_reports) : "—",
      accent: Boolean(metrics && metrics.ai_failed_reports > 0),
    },
    {
      label: t("metricAvgTriageTime"),
      value: metrics
        ? formatTriageDuration(metrics.avg_triage_seconds)
        : "—",
      accent: false,
    },
  ];

  return (
    <div
      data-slot="reports-metrics"
      className={cn(
        "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
        compact ? "gap-2.5" : "gap-4",
      )}
    >
      {cells.map((cell, index) => {
        const Icon = METRIC_ICONS[index];
        return (
          <div
            key={cell.label}
            className={cn(
              DELAY_CLASSES[index],
              "surface-card flex flex-col",
              compact ? "gap-2 p-3" : "gap-4 p-5",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  "font-medium text-muted-foreground text-pretty",
                  compact ? "text-xs leading-snug" : "text-sm",
                )}
              >
                {cell.label}
              </p>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center justify-center rounded-md",
                  compact ? "size-7" : "size-9 rounded-lg",
                  cell.accent
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary",
                )}
              >
                <Icon className={compact ? "size-3.5" : "size-4"} aria-hidden />
              </span>
            </div>
            <p
              className={cn(
                "font-heading font-semibold tabular-nums leading-none tracking-tight text-foreground",
                compact ? "text-[1.3125rem]" : "text-[1.75rem]",
              )}
            >
              {cell.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
