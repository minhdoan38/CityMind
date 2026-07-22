import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ExportButton from "@/components/reports/ExportButton";
import DashboardInsightsRail from "@/components/dashboard/DashboardInsightsRail";
import ReportsFilters from "@/components/reports/ReportsFilters";
import ReportsMetrics from "@/components/reports/ReportsMetrics";
import ReportsTable from "@/components/reports/ReportsTable";
import ReportsViewToggle from "@/components/reports/ReportsViewToggle";
import ReportsMapViewLoader from "@/components/reports/ReportsMapViewLoader";
import {
  hasActiveFilters,
  type DashboardSearchParams,
} from "@/components/reports/types";
import { loadDashboardBundle } from "@/server/services/officer-dashboard";

type Props = {
  searchParams: Promise<DashboardSearchParams & { focus?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const normalized: DashboardSearchParams = {
    ...params,
    limit: params.limit ?? "25",
    sort: params.sort ?? "triage_bucket",
    order: params.order ?? "asc",
  };
  const isMapView = normalized.view === "map";
  const t = await getTranslations("dashboard");
  const tMap = await getTranslations("dashboard.map");
  const terror = await getTranslations("error");
  const result = await loadDashboardBundle(normalized, isMapView);
  const filtersActive = hasActiveFilters(normalized);
  const focusExport = params.focus === "export";

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="dash-rise flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {t("pageTitle")}
          </h1>
          <p className="mt-1.5 max-w-2xl text-base text-muted-foreground">
            {isMapView ? tMap("pageSubtitle") : t("pageSubtitle")}
          </p>
        </div>
        <div className="dash-rise dash-rise-delay-1 flex flex-col items-stretch gap-3 sm:items-end">
          <ReportsViewToggle />
          <ExportButton params={normalized} focusExport={focusExport} />
        </div>
      </div>

      <ReportsFilters params={normalized} />
      <div className="dash-rise dash-rise-delay-2">
        <ReportsMetrics metrics={result.metrics} />
      </div>

      {!result.error && (
        <DashboardInsightsRail
          metrics={result.metrics}
          layout="grid"
          className="2xl:hidden"
        />
      )}

      {result.error && (
        <Alert variant="destructive">
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>
            {result.error === "api" ? terror("apiConnection") : terror("loadFailed")}
          </AlertDescription>
        </Alert>
      )}

      {!result.error && isMapView && (
        <>
          <ReportsMapViewLoader params={normalized} />
          <DashboardInsightsRail
            metrics={result.metrics}
            layout="grid"
            className="2xl:hidden"
          />
          <DashboardInsightsRail
            metrics={result.metrics}
            layout="rail"
            className="hidden max-w-sm 2xl:grid"
          />
        </>
      )}

      {!result.error && !isMapView && (
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          <div className="min-w-0">
            <ReportsTable
              rows={result.rows}
              nextCursor={result.nextCursor}
              params={normalized}
              filtersActive={filtersActive}
            />
          </div>
          <DashboardInsightsRail
            metrics={result.metrics}
            layout="rail"
            className="hidden 2xl:grid"
          />
        </div>
      )}
    </div>
  );
}
