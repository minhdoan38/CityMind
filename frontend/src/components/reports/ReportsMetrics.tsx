import { getTranslations } from "next-intl/server";

import type { SummaryMetrics } from "./types";

type Props = {
  metrics: SummaryMetrics | null;
};

export default async function ReportsMetrics({ metrics }: Props) {
  const t = await getTranslations("dashboard");

  const cells = [
    {
      label: t("metricTotal"),
      value: metrics ? String(metrics.total_reports) : "—",
    },
    {
      label: t("metricCritical"),
      value: metrics ? String(metrics.critical_reports) : "—",
    },
    {
      label: t("metricAvgSeverity"),
      value:
        metrics?.avg_severity != null
          ? Number(metrics.avg_severity).toFixed(1)
          : "—",
    },
    {
      label: t("metricTopCategory"),
      value: metrics?.top_category?.trim() || "—",
    },
  ];

  return (
    <div
      data-slot="reports-metrics"
      className="grid gap-4 rounded-lg border border-border bg-secondary/40 p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {cells.map((cell) => (
        <div key={cell.label} className="space-y-1">
          <p className="text-sm font-normal text-muted-foreground">{cell.label}</p>
          <p className="text-xl font-semibold text-foreground">{cell.value}</p>
        </div>
      ))}
    </div>
  );
}
