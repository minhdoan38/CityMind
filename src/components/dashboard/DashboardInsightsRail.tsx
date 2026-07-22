import type { SummaryMetrics } from "@/components/reports/types";
import { cn } from "@/lib/utils";

import AdvisoryAssistantWidget from "./widgets/AdvisoryAssistantWidget";
import BusiestDayWidget from "./widgets/BusiestDayWidget";
import ResolutionRateWidget from "./widgets/ResolutionRateWidget";

const DEFAULT_DOW = [
  { day: "sun" as const, count: 0 },
  { day: "mon" as const, count: 0 },
  { day: "tue" as const, count: 0 },
  { day: "wed" as const, count: 0 },
  { day: "thu" as const, count: 0 },
  { day: "fri" as const, count: 0 },
  { day: "sat" as const, count: 0 },
];

type Props = {
  metrics: SummaryMetrics | null;
  className?: string;
  layout?: "rail" | "grid";
};

export default function DashboardInsightsRail({
  metrics,
  className,
  layout = "rail",
}: Props) {
  const dow = metrics?.reports_by_dow ?? DEFAULT_DOW;
  const rate = metrics?.resolution_rate ?? 0;
  const resolved = metrics?.resolved_reports ?? 0;
  const total = metrics?.total_reports ?? 0;

  return (
    <aside
      className={cn(
        layout === "rail"
          ? "grid gap-4"
          : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
      aria-label="Dashboard insights"
    >
      <BusiestDayWidget data={dow} delayClass="dash-rise dash-rise-delay-1" />
      <ResolutionRateWidget
        rate={rate}
        resolved={resolved}
        total={total}
        delayClass="dash-rise dash-rise-delay-2"
      />
      <AdvisoryAssistantWidget delayClass="dash-rise dash-rise-delay-3" />
    </aside>
  );
}
