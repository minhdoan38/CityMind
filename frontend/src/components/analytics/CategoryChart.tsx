"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import ChartBlock from "./ChartBlock";
import { bucketCategories, type AnalyticsCategoryCount } from "./types";

type Props = {
  data: AnalyticsCategoryCount[];
  warehouseEmpty: boolean;
  loading?: boolean;
};

const NEUTRAL_FILLS = [
  "color-mix(in srgb, var(--foreground) 85%, transparent)",
  "color-mix(in srgb, var(--foreground) 65%, transparent)",
  "color-mix(in srgb, var(--muted-foreground) 90%, transparent)",
  "color-mix(in srgb, var(--muted-foreground) 70%, transparent)",
  "color-mix(in srgb, var(--muted-foreground) 50%, transparent)",
  "color-mix(in srgb, var(--accent) 80%, transparent)",
];

export default function CategoryChart({ data, warehouseEmpty, loading }: Props) {
  const t = useTranslations("dashboard.analytics");
  const otherLabel = t("categoryOther");
  const rows = useMemo(
    () => bucketCategories(data, otherLabel),
    [data, otherLabel],
  );
  const isEmpty = rows.length === 0;
  const total = rows.reduce((sum, row) => sum + row.report_count, 0);

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        rows.map((row, index) => [
          row.category,
          {
            label: row.category,
            color: NEUTRAL_FILLS[index % NEUTRAL_FILLS.length],
          },
        ]),
      ),
    [rows],
  );

  return (
    <ChartBlock
      title={t("categoryTitle")}
      caption={t("categoryCaption")}
      summary={t("categorySummary", { count: total })}
      loading={loading}
      isEmpty={isEmpty}
      emptyHeading={
        warehouseEmpty ? t("emptyWarehouseHeading") : t("emptyHeading")
      }
      emptyBody={warehouseEmpty ? t("emptyWarehouseBody") : t("emptyBody")}
    >
      <ChartContainer
        config={chartConfig}
        className="aspect-auto min-h-[200px] w-full md:min-h-[240px]"
      >
        <BarChart
          data={rows}
          layout="vertical"
          accessibilityLayer
          margin={{ left: 8, right: 16 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="category"
            width={96}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="report_count" />}
          />
          <Bar
            dataKey="report_count"
            radius={4}
            isAnimationActive={false}
            fill="color-mix(in srgb, var(--foreground) 70%, transparent)"
          />
        </BarChart>
      </ChartContainer>
    </ChartBlock>
  );
}
