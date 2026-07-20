"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import ChartBlock from "./ChartBlock";
import type { AnalyticsVolumePoint } from "./types";

type Props = {
  data: AnalyticsVolumePoint[];
  warehouseEmpty: boolean;
  loading?: boolean;
};

const chartConfig = {
  report_count: {
    label: "Reports",
    color: "var(--primary)",
  },
};

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function VolumeChart({ data, warehouseEmpty, loading }: Props) {
  const t = useTranslations("dashboard.analytics");
  const isEmpty = data.length === 0;
  const total = data.reduce((sum, point) => sum + point.report_count, 0);

  return (
    <ChartBlock
      title={t("volumeTitle")}
      caption={t("volumeCaption")}
      summary={t("volumeSummary", { count: total })}
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
        <BarChart data={data} accessibilityLayer margin={{ left: 0, right: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={formatDay}
            minTickGap={24}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="report_count" />}
          />
          <Bar
            dataKey="report_count"
            fill="var(--color-primary)"
            radius={4}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </ChartBlock>
  );
}
