import { getTranslations } from "next-intl/server";

import { officerFetch } from "@/lib/backend";
import AnalyticsErrorAlert from "@/components/analytics/AnalyticsErrorAlert";
import DateRangeToolbar from "@/components/analytics/DateRangeToolbar";
import {
  resolveAnalyticsRange,
  type AnalyticsResponse,
  type AnalyticsSearchParams,
} from "@/components/analytics/types";

type Props = {
  searchParams: Promise<AnalyticsSearchParams>;
};

async function loadAnalytics(
  from: string,
  to: string,
): Promise<{ data: AnalyticsResponse | null; error: "load" | "api" | null }> {
  try {
    const res = await officerFetch(
      `/api/v1/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      return { data: null, error: "load" };
    }
    const data = (await res.json()) as AnalyticsResponse;
    return { data, error: null };
  } catch {
    return { data: null, error: "api" };
  }
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveAnalyticsRange(params);
  const t = await getTranslations("dashboard.analytics");

  let data: AnalyticsResponse | null = null;
  let error: "load" | "api" | null = null;

  if (range.valid) {
    const result = await loadAnalytics(range.from, range.to);
    data = result.data;
    error = result.error;
  }
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
        <div className="space-y-6" data-testid="analytics-chart-slots">
          <p className="text-sm text-muted-foreground">
            {t("freshnessNote")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
