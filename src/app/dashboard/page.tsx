import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ExportButton from "@/components/reports/ExportButton";
import DashboardInsightsRail from "@/components/dashboard/DashboardInsightsRail";
import ReportsDateRangeFilter from "@/components/reports/ReportsDateRangeFilter";
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
    <div className="reports-page w-full max-w-none space-y-4">
      <header className="reports-page-header dash-rise flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="reports-page-title font-heading text-balance">
            {t("pageTitle")}
          </h1>
          <p className="reports-page-lead text-pretty">
            {isMapView ? tMap("pageSubtitle") : t("pageSubtitle")}
          </p>
        </div>
        <div className="dash-rise dash-rise-delay-1 flex w-full flex-wrap items-center gap-2 sm:gap-2.5 lg:w-auto lg:justify-end">
          <ReportsDateRangeFilter
            params={normalized}
            showPeriodPresets={false}
            className="w-full sm:w-auto"
          />
          <ReportsViewToggle />
          <ExportButton params={normalized} focusExport={focusExport} />
        </div>
      </header>

      {result.error && (
        <Alert variant="destructive">
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>
            {result.error === "api" ? terror("apiConnection") : terror("loadFailed")}
          </AlertDescription>
        </Alert>
      )}

      {!result.error && isMapView && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-start">
          <div className="min-w-0 space-y-3">
            <ReportsMetrics metrics={result.metrics} compact />
            <div className="reports-queue surface-card overflow-hidden">
              <ReportsFilters params={normalized} layout="toolbar" />
              <ReportsMapViewLoader params={normalized} />
            </div>
          </div>
          <DashboardInsightsRail
            metrics={result.metrics}
            layout="rail"
            className="lg:sticky lg:top-[calc(4rem+1.5rem)] lg:self-start"
          />
        </div>
      )}

      {!result.error && !isMapView && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-start">
          <div className="min-w-0 space-y-3 dash-rise dash-rise-delay-1">
            <ReportsMetrics metrics={result.metrics} compact />
            <div className="reports-queue surface-card overflow-hidden">
              <ReportsFilters params={normalized} layout="toolbar" />
              <ReportsTable
                embedded
                rows={result.rows}
                nextCursor={result.nextCursor}
                params={normalized}
                filtersActive={filtersActive}
                totalCount={result.metrics?.total_reports ?? null}
              />
            </div>
          </div>
          <DashboardInsightsRail
            metrics={result.metrics}
            layout="rail"
            className="lg:sticky lg:top-[calc(4rem+1.5rem)] lg:self-start"
          />
        </div>
      )}
    </div>
  );
}
