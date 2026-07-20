import { getTranslations } from "next-intl/server";

import { officerFetch } from "@/lib/backend";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ReportsFilters from "@/components/reports/ReportsFilters";
import ReportsMetrics from "@/components/reports/ReportsMetrics";
import ReportsTable from "@/components/reports/ReportsTable";
import {
  buildReportsQuery,
  hasActiveFilters,
  type DashboardSearchParams,
  type ReportRow,
  type SummaryMetrics,
} from "@/components/reports/types";

type Props = {
  searchParams: Promise<DashboardSearchParams>;
};

type FetchBundle = {
  rows: ReportRow[];
  nextCursor: string | null;
  metrics: SummaryMetrics | null;
  error: string | null;
};

async function loadDashboard(params: DashboardSearchParams): Promise<FetchBundle> {
  const listQs = buildReportsQuery(params, { includeCursor: true });
  const summaryQs = buildReportsQuery(
    { ...params, cursor: undefined },
    { includeCursor: false },
  );

  try {
    const [listRes, summaryRes] = await Promise.all([
      officerFetch(`/api/v1/reports/recent?${listQs}`, { cache: "no-store" }),
      officerFetch(`/api/v1/reports/summary?${summaryQs}`, { cache: "no-store" }),
    ]);

    if (!listRes.ok) {
      return {
        rows: [],
        nextCursor: null,
        metrics: null,
        error: "load",
      };
    }

    const listBody = await listRes.json();
    let metrics: SummaryMetrics | null = null;
    if (summaryRes.ok) {
      metrics = (await summaryRes.json()) as SummaryMetrics;
    }

    return {
      rows: (listBody.items ?? []) as ReportRow[],
      nextCursor: (listBody.next_cursor as string | null) ?? null,
      metrics,
      error: null,
    };
  } catch {
    return {
      rows: [],
      nextCursor: null,
      metrics: null,
      error: "api",
    };
  }
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const normalized: DashboardSearchParams = {
    ...params,
    limit: params.limit ?? "25",
    sort: params.sort ?? "created_at",
    order: params.order ?? "desc",
  };
  const t = await getTranslations("dashboard");
  const terror = await getTranslations("error");
  const result = await loadDashboard(normalized);
  const filtersActive = hasActiveFilters(normalized);

  return (
    <div className="w-full max-w-none space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("pageTitle")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">{t("pageSubtitle")}</p>
      </div>

      <ReportsFilters params={normalized} />
      <ReportsMetrics metrics={result.metrics} />

      {result.error && (
        <Alert variant="destructive">
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>
            {result.error === "api" ? terror("apiConnection") : terror("loadFailed")}
          </AlertDescription>
        </Alert>
      )}

      {!result.error && (
        <ReportsTable
          rows={result.rows}
          nextCursor={result.nextCursor}
          params={normalized}
          filtersActive={filtersActive}
        />
      )}
    </div>
  );
}
