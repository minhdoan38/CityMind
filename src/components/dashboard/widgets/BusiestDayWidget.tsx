"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { DayOfWeekCount } from "@/components/reports/types";
import { cn } from "@/lib/utils";

import WidgetCard from "./WidgetCard";

const DAY_ORDER: DayOfWeekCount["day"][] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

type Props = {
  data: DayOfWeekCount[];
  delayClass?: string;
};

export default function BusiestDayWidget({ data, delayClass }: Props) {
  const t = useTranslations("dashboard.widgets");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const rows = useMemo(() => {
    const byDay = new Map(data.map((item) => [item.day, item.count]));
    return DAY_ORDER.map((day) => ({
      day,
      count: byDay.get(day) ?? 0,
      label: t(`day_${day}`),
    }));
  }, [data, t]);

  const peak = useMemo(() => {
    let max = 0;
    let peakDay: DayOfWeekCount["day"] | null = null;
    for (const row of rows) {
      if (row.count > max) {
        max = row.count;
        peakDay = row.day;
      }
    }
    return { day: peakDay, count: max };
  }, [rows]);

  const maxCount = Math.max(...rows.map((row) => row.count), 1);

  return (
    <WidgetCard title={t("busiestDayTitle")} delayClass={delayClass}>
      <div className="flex h-[180px] items-end justify-between gap-2">
        {rows.map((row) => {
          const isPeak = peak.day === row.day && peak.count > 0;
          const height = `${Math.max((row.count / maxCount) * 100, row.count > 0 ? 12 : 4)}%`;
          return (
            <div
              key={row.day}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
            >
              {isPeak ? (
                <span className="text-xs font-semibold tabular-nums text-foreground">
                  {row.count.toLocaleString()}
                </span>
              ) : (
                <span className="h-4" aria-hidden />
              )}
              <div className="flex h-28 w-full items-end justify-center">
                <div
                  className={cn(
                    "w-full max-w-[2.25rem] origin-bottom rounded-t-xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                    isPeak
                      ? "bg-primary shadow-[0_8px_20px_oklch(0.55_0.18_260/0.35)]"
                      : "bg-muted",
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
                  "text-xs font-medium",
                  isPeak ? "text-primary" : "text-muted-foreground",
                )}
              >
                {row.label}
              </span>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
