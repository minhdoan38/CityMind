"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";

import type {
  CategoryWorkloadCount,
  StatusWorkloadCount,
  SummaryMetrics,
  VolumeDayCount,
} from "@/components/reports/types";
import { Button } from "@/components/ui/button";
import { resolveDashboardDateLocale } from "@/lib/dashboard-datetime";
import { cn } from "@/lib/utils";

import WidgetCard from "./WidgetCard";

type InsightTab = "trend" | "status" | "categories";

type Props = {
  metrics: SummaryMetrics | null;
  delayClass?: string;
};

const EMPTY_VOLUME: VolumeDayCount[] = [];
const EMPTY_STATUS: StatusWorkloadCount[] = [
  { status: "new", count: 0 },
  { status: "reviewing", count: 0 },
  { status: "resolved", count: 0 },
  { status: "rejected", count: 0 },
];

function formatTrendLabel(day: string, locale: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return date.toLocaleDateString(resolveDashboardDateLocale(locale), {
    weekday: "short",
    timeZone: "UTC",
  });
}

function formatCategoryLabel(category: string): string {
  return category.replace(/_/g, " ");
}

type MiniBarsProps = {
  rows: Array<{ key: string; label: string; count: number; tone?: string }>;
  mounted: boolean;
  emptyLabel: string;
};

function MiniBars({ rows, mounted, emptyLabel }: MiniBarsProps) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (total === 0) {
    return (
      <p className="flex min-h-[168px] items-center justify-center text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="flex min-h-[168px] items-end justify-between gap-1.5">
      {rows.map((row) => {
        const height = `${Math.max((row.count / max) * 100, row.count > 0 ? 14 : 6)}%`;
        const isPeak = row.count === max && row.count > 0;
        return (
          <div
            key={row.key}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
          >
            {row.count > 0 ? (
              <span
                className={cn(
                  "text-[0.6875rem] font-semibold tabular-nums",
                  isPeak ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {row.count.toLocaleString()}
              </span>
            ) : (
              <span className="h-3.5" aria-hidden />
            )}
            <div className="flex h-[7.5rem] w-full items-end justify-center">
              <div
                className={cn(
                  "w-full max-w-[2rem] origin-bottom rounded-t-lg transition-transform duration-500 ease-[var(--ease-out-expo)] motion-reduce:transition-none",
                  row.tone ?? (isPeak ? "bg-primary" : "bg-muted"),
                  isPeak && "shadow-[0_6px_16px_oklch(0.55_0.18_260/0.28)]",
                )}
                style={{
                  height,
                  transform: mounted ? "scaleY(1)" : "scaleY(0)",
                }}
                role="img"
                aria-label={`${row.label}: ${row.count}`}
              />
            </div>
            <span
              className={cn(
                "w-full truncate text-center text-[0.6875rem] font-medium",
                isPeak ? "text-primary" : "text-muted-foreground",
              )}
              title={row.label}
            >
              {row.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type WorkloadRowsProps = {
  rows: Array<{ key: string; label: string; count: number; toneClass: string }>;
  emptyLabel: string;
};

function WorkloadRows({ rows, emptyLabel }: WorkloadRowsProps) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(...rows.map((row) => row.count), 1);

  if (total === 0) {
    return (
      <p className="flex min-h-[168px] items-center justify-center text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="flex min-h-[168px] flex-col justify-center gap-3">
      {rows.map((row) => {
        const width = `${Math.max((row.count / max) * 100, row.count > 0 ? 8 : 0)}%`;
        return (
          <li key={row.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium text-foreground">{row.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {row.count.toLocaleString()}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/70">
              <div
                className={cn("h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-expo)] motion-reduce:transition-none", row.toneClass)}
                style={{ width }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function OperationsInsightsWidget({ metrics, delayClass }: Props) {
  const locale = useLocale();
  const t = useTranslations("dashboard.widgets");
  const [tab, setTab] = useState<InsightTab>("trend");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const volume = metrics?.volume_7d ?? EMPTY_VOLUME;
  const statusRows = metrics?.workload_by_status ?? EMPTY_STATUS;
  const categoryRows = metrics?.top_categories ?? [];
  const slaOverdue = metrics?.sla_overdue_reports ?? 0;
  const trendTotal = volume.reduce((sum, point) => sum + point.count, 0);

  const trendBars = useMemo(
    () =>
      volume.map((point) => ({
        key: point.day,
        label: formatTrendLabel(point.day, locale),
        count: point.count,
      })),
    [locale, volume],
  );

  const statusBars = useMemo(
    () =>
      statusRows.map((row) => ({
        key: row.status,
        label: t(`status_${row.status}`),
        count: row.count,
        toneClass:
          row.status === "new"
            ? "bg-primary/80"
            : row.status === "reviewing"
              ? "bg-[oklch(0.72_0.14_75)]"
              : row.status === "resolved"
                ? "bg-[oklch(0.62_0.1_145)]"
                : "bg-destructive/75",
      })),
    [statusRows, t],
  );

  const categoryBars = useMemo(
    () =>
      categoryRows.map((row: CategoryWorkloadCount) => ({
        key: row.category,
        label: formatCategoryLabel(row.category),
        count: row.count,
        toneClass: "bg-primary/70",
      })),
    [categoryRows],
  );

  const tabs: Array<{ id: InsightTab; label: string }> = [
    { id: "trend", label: t("insightsTabTrend") },
    { id: "status", label: t("insightsTabStatus") },
    { id: "categories", label: t("insightsTabCategories") },
  ];

  return (
    <WidgetCard
      title={t("insightsTitle")}
      delayClass={delayClass}
      action={
        <Button
          asChild
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Link href="/dashboard/analytics" aria-label={t("insightsOpenAnalytics")}>
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <div
          className="dash-segmented"
          role="tablist"
          aria-label={t("insightsTitle")}
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={cn(
                "min-h-10 flex-1 rounded-[calc(var(--radius-control)-2px)] px-2 text-xs font-semibold transition-colors duration-150 ease-[var(--ease-out-expo)]",
                tab === item.id
                  ? "dash-selected border-transparent"
                  : "border border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {tab === "trend" ? (
            <MiniBars
              rows={trendBars}
              mounted={mounted}
              emptyLabel={t("insightsEmpty")}
            />
          ) : null}
          {tab === "status" ? (
            <WorkloadRows rows={statusBars} emptyLabel={t("insightsEmpty")} />
          ) : null}
          {tab === "categories" ? (
            <WorkloadRows rows={categoryBars} emptyLabel={t("insightsEmptyCategories")} />
          ) : null}
        </div>

        <div className="space-y-2 border-t border-dashed border-border pt-3">
          {tab === "trend" ? (
            <p className="text-sm text-muted-foreground">
              {t("insightsTrendSummary", { count: trendTotal })}
            </p>
          ) : null}
          {slaOverdue > 0 ? (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium",
                "border border-destructive/25 bg-destructive/8 text-[color-mix(in_oklch,var(--destructive)_82%,var(--foreground))]",
              )}
            >
              {t("insightsSlaBreaches", { count: slaOverdue })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("insightsSlaClear")}</p>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}
