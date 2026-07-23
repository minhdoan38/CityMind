import type { SummaryMetrics } from "@/components/reports/types";
import { cn } from "@/lib/utils";

import AdvisoryAssistantWidget from "./widgets/AdvisoryAssistantWidget";
import OperationsInsightsWidget from "./widgets/OperationsInsightsWidget";
import ResolutionRateWidget from "./widgets/ResolutionRateWidget";

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
      <OperationsInsightsWidget
        metrics={metrics}
        delayClass="dash-rise dash-rise-delay-1"
      />
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
