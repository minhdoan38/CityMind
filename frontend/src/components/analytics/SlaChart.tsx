"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import ChartBlock from "./ChartBlock";
import type { AnalyticsSlaSummary } from "./types";

type Props = {
  data: AnalyticsSlaSummary;
  warehouseEmpty: boolean;
  loading?: boolean;
};

const chartConfig = {
  count: {
    label: "Closed reports",
    color: "color-mix(in srgb, var(--foreground) 70%, transparent)",
  },
};

export default function SlaChart({ data, warehouseEmpty, loading }: Props) {
  const t = useTranslations("dashboard.analytics");
  const histogram = data.histogram ?? [];
  const isEmpty = data.closed_count === 0 || histogram.length === 0;
  const medianLabel =
    data.median_days != null
      ? t("slaMedian", { days: data.median_days.toFixed(1) })
      : t("slaNoMedian");

  return (
    <ChartBlock
      title={t("slaTitle")}
      caption={`${t("slaCaption")} ${medianLabel}`}
      summary={t("slaSummary", { count: data.closed_count })}
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
        <BarChart data={histogram} accessibilityLayer margin={{ left: 0, right: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="count" />}
          />
          <Bar
            dataKey="count"
            fill="color-mix(in srgb, var(--foreground) 70%, transparent)"
            radius={4}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </ChartBlock>
  );
}
