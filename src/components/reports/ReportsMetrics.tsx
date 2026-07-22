import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  FileText,
  Gauge,
  Tag,
} from "lucide-react";

import type { SummaryMetrics } from "./types";

type Props = {
  metrics: SummaryMetrics | null;
};

const METRIC_ICONS = [FileText, AlertTriangle, Gauge, Tag] as const;
const DELAY_CLASSES = [
  "dash-rise dash-rise-delay-1",
  "dash-rise dash-rise-delay-2",
  "dash-rise dash-rise-delay-3",
  "dash-rise dash-rise-delay-4",
] as const;

export default async function ReportsMetrics({ metrics }: Props) {
  const t = await getTranslations("dashboard");

  const cells = [
    {
      label: t("metricTotal"),
      value: metrics ? String(metrics.total_reports) : "—",
      hint: metrics ? "reports" : "",
    },
    {
      label: t("metricCritical"),
      value: metrics ? String(metrics.critical_reports) : "—",
      hint: metrics && metrics.critical_reports > 0 ? "needs review" : "",
      accent: metrics && metrics.critical_reports > 0,
    },
    {
      label: t("metricAvgSeverity"),
      value:
        metrics?.avg_severity != null
          ? Number(metrics.avg_severity).toFixed(1)
          : "—",
      hint: "avg score",
    },
    {
      label: t("metricTopCategory"),
      value: metrics?.top_category?.trim() || "—",
      hint: "top category",
    },
  ];

  return (
    <div
      data-slot="reports-metrics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cells.map((cell, index) => {
        const Icon = METRIC_ICONS[index];
        return (
          <div
            key={cell.label}
            className={`${DELAY_CLASSES[index]} surface-card flex flex-col gap-4 p-5`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">
                {cell.label}
              </p>
              <span
                className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  cell.accent
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <Icon className="size-4" aria-hidden />
              </span>
            </div>
            <div>
              <p className="font-heading text-[1.75rem] font-semibold tabular-nums leading-none tracking-tight text-foreground">
                {cell.value}
              </p>
              {cell.hint ? (
                <p className="mt-2 text-xs text-muted-foreground">{cell.hint}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
