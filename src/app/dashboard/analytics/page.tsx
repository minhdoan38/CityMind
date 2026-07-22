import { getTranslations } from "next-intl/server";

import AnalyticsErrorAlert from "@/components/analytics/AnalyticsErrorAlert";
import CategoryChart from "@/components/analytics/CategoryChart";
import DateRangeToolbar from "@/components/analytics/DateRangeToolbar";
import HotspotTable from "@/components/analytics/HotspotTable";
import SlaChart from "@/components/analytics/SlaChart";
import VolumeChart from "@/components/analytics/VolumeChart";
import {
  resolveAnalyticsRange,
  type AnalyticsResponse,
  type AnalyticsSearchParams,
} from "@/components/analytics/types";
import { loadOfficerAnalytics } from "@/server/services/officer-analytics";

type Props = {
  searchParams: Promise<AnalyticsSearchParams>;
};

export default async function AnalyticsPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveAnalyticsRange(params);
  const t = await getTranslations("dashboard.analytics");

  let data: AnalyticsResponse | null = null;
  let error: "load" | "api" | null = null;

  if (range.valid) {
    const result = await loadOfficerAnalytics(range.from, range.to);
    data = result.data;
    error = result.error;
  }
  const warehouseEmpty = Boolean(data?.empty);

  return (
    <div className="w-full max-w-none space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("pageTitle")}
        </h1>
        <p className="text-base text-muted-foreground">{t("pageSubtitle")}</p>
        <p className="text-sm text-muted-foreground">{t("freshnessNote")}</p>
      </div>

      <DateRangeToolbar params={params} invalid={!range.valid} />

      {error ? <AnalyticsErrorAlert kind={error} /> : null}

      {range.valid && !error && data ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <VolumeChart
              data={data.volume}
              warehouseEmpty={warehouseEmpty}
            />
            <CategoryChart
              data={data.category_mix}
              warehouseEmpty={warehouseEmpty}
            />
          </div>
          <SlaChart data={data.sla} warehouseEmpty={warehouseEmpty} />
          <HotspotTable data={data.hotspots} warehouseEmpty={warehouseEmpty} />
        </div>
      ) : null}
    </div>
  );
}
