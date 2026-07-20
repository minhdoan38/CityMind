import Link from "next/link";
import { getTranslations } from "next-intl/server";

import CopyStatusLink from "@/components/CopyStatusLink";
import StatusActions from "@/components/StatusActions";
import { requireOfficerSession } from "@/lib/auth";
import { officerFetch } from "@/lib/backend";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = { params: Promise<{ reportId: string }> };

type Report = {
  report_id: string;
  created_at: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  category: string;
  severity: number;
  confidence: number;
  summary: string;
  recommendation: string;
  priority: string;
  estimated_impact?: string;
  evidence?: string[];
  uncertainty?: string[];
  urban_context?: string | Record<string, unknown> | null;
  image_gcs_uri?: string | null;
  status?: string;
  status_note?: string | null;
};

type StatusEvent = {
  status: string;
  note?: string | null;
  actor_id?: string | null;
  created_at: string;
};

type FetchResult<T> =
  | { data: T; error: null; notFound?: false }
  | { data: null; error: string; notFound?: boolean };

async function getReport(reportId: string): Promise<FetchResult<Report>> {
  try {
    const res = await officerFetch(`/api/v1/reports/${reportId}`, {
      cache: "no-store",
    });
    if (res.status === 404) {
      return { data: null, error: "not_found", notFound: true };
    }
    if (!res.ok) {
      return { data: null, error: "load_error" };
    }
    return { data: await res.json(), error: null };
  } catch {
    return { data: null, error: "api_error" };
  }
}

async function getHistory(reportId: string): Promise<FetchResult<StatusEvent[]>> {
  try {
    const res = await officerFetch(
      `/api/v1/reports/${reportId}/status-history`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      return { data: null, error: "history_error" };
    }
    const body = await res.json();
    return { data: body.items ?? [], error: null };
  } catch {
    return { data: null, error: "history_error" };
  }
}

function parseUrbanContext(
  value: Report["urban_context"],
): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return { context: value };
  }
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB");
}

function truncateActor(actorId: string) {
  if (actorId.length <= 12) return actorId;
  return `${actorId.slice(0, 8)}…`;
}

function SignalList({
  items,
  emptyLabel,
}: {
  items?: string[];
  emptyLabel: string;
}) {
  if (!items?.length) {
    return <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default async function ReportDetail({ params }: Props) {
  await requireOfficerSession();
  const t = await getTranslations("dashboard");
  const terror = await getTranslations("error");
  const { reportId } = await params;
  const [reportResult, historyResult] = await Promise.all([
    getReport(reportId),
    getHistory(reportId),
  ]);

  if (!reportResult.data) {
    return (
      <Card className="border border-border p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold">
          {reportResult.notFound ? t("detailNotFound") : t("detailUnavailable")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {reportResult.error === "api_error"
            ? terror("apiConnection")
            : t("detailLoadError")}
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block text-primary hover:underline"
        >
          ← {t("detailBack")}
        </Link>
      </Card>
    );
  }

  const report = reportResult.data;
  const history = historyResult.data ?? [];
  const urbanContext = parseUrbanContext(report.urban_context);
  const statusKey = `status_${report.status ?? "new"}` as
    | "status_new"
    | "status_reviewing"
    | "status_resolved"
    | "status_rejected";
  const statusLabel = t.has(statusKey)
    ? t(statusKey)
    : (report.status ?? "new");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href="/dashboard"
        className="text-sm font-semibold text-primary hover:underline"
      >
        ← {t("detailBack")}
      </Link>

      {/* 1. Header meta */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold capitalize tracking-tight text-foreground">
            {report.category || "Uncategorized report"}
          </h1>
          <p className="mt-2 break-all text-xs text-muted-foreground">
            ID: {report.report_id}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("detailSubmitted", { date: formatDate(report.created_at) })}
          </p>
          <CopyStatusLink reportId={report.report_id} />
        </div>
        <span className="inline-flex items-center rounded-md bg-secondary px-3 py-1 text-sm font-normal capitalize text-foreground">
          {t("detailStatus", { status: statusLabel })}
        </span>
      </header>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 rounded-lg border border-border bg-secondary/40 p-4">
        {[
          [t("detailPriority"), report.priority],
          [t("detailSeverity"), `${report.severity}/5`],
          [t("detailConfidence"), `${Math.round(report.confidence * 100)}%`],
          [
            t("detailImpact"),
            report.estimated_impact || t("detailNotAvailable"),
          ],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-xs uppercase text-muted-foreground font-normal">
              {label}
            </p>
            <p className="mt-1 font-semibold capitalize text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* 2. Citizen description */}
      {report.description && (
        <section className="space-y-2 rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {t("detailCitizen")}
          </h2>
          <p className="whitespace-pre-wrap text-base text-foreground">
            {report.description}
          </p>
        </section>
      )}

      {/* 3. Evidence — image + signals */}
      <section className="space-y-4 rounded-lg border border-border p-6">
        <h2 className="text-xl font-semibold text-foreground">
          {t("detailEvidence")}
        </h2>
        {report.image_gcs_uri && (
          <div className="space-y-2">
            <h3 className="text-sm font-normal text-muted-foreground">
              {t("detailEvidenceImage")}
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/officer/reports/${report.report_id}/image`}
              alt="Citizen-provided report evidence"
              className="max-h-96 rounded-md border border-border object-contain"
            />
          </div>
        )}
        <div>
          <h3 className="text-sm font-normal text-muted-foreground">
            {t("detailEvidenceSignals")}
          </h3>
          <SignalList
            items={report.evidence}
            emptyLabel={t("detailNoneRecorded")}
          />
        </div>
        {(report.latitude != null || report.longitude != null) && (
          <div className="space-y-1 border-t border-border pt-4">
            <h3 className="text-sm font-normal text-muted-foreground">
              {t("detailLocation")}
            </h3>
            <p className="text-sm text-foreground">
              Latitude: {report.latitude ?? t("detailNotAvailable")} · Longitude:{" "}
              {report.longitude ?? t("detailNotAvailable")}
            </p>
          </div>
        )}
      </section>

      {/* 4. AI analysis (advisory) */}
      <section className="space-y-4 rounded-lg border border-border bg-[#EFF6FF] p-6">
        <h2 className="text-xl font-semibold text-foreground">
          {t("detailAiTitle")}
        </h2>
        <Alert className="border border-border bg-background/80">
          <AlertDescription className="text-sm text-foreground">
            {t("detailAiDisclaimer")}
          </AlertDescription>
        </Alert>
        <div className="space-y-2">
          <h3 className="text-sm font-normal text-muted-foreground">
            {t("detailSummary")}
          </h3>
          <p className="text-base text-foreground">{report.summary}</p>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-normal text-muted-foreground">
            {t("detailRecommendation")}
          </h3>
          <p className="text-base text-foreground">{report.recommendation}</p>
        </div>
        <div>
          <h3 className="text-sm font-normal text-muted-foreground">
            {t("detailUncertainty")}
          </h3>
          <SignalList
            items={report.uncertainty}
            emptyLabel={t("detailNoneRecorded")}
          />
        </div>
      </section>

      {/* 5. Urban context */}
      <section className="space-y-3 rounded-lg border border-border p-6">
        <h2 className="text-xl font-semibold text-foreground">
          {t("detailUrban")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("detailUrbanHelper")}</p>
        {urbanContext && Object.keys(urbanContext).length > 0 ? (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-secondary p-4 text-xs font-mono text-foreground border border-border">
            {JSON.stringify(urbanContext, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">{t("detailNoUrban")}</p>
        )}
      </section>

      {/* 6. Status timeline (newest-first from API) */}
      <section className="space-y-4 rounded-lg border border-border p-6">
        <h2 className="text-xl font-semibold text-foreground">
          {t("detailTimeline")}
        </h2>
        {historyResult.error && (
          <Alert variant="destructive">
            <AlertDescription>{t("detailHistoryError")}</AlertDescription>
          </Alert>
        )}
        {!historyResult.error && history.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("detailTimelineEmpty")}
          </p>
        )}
        <ol className="grid gap-3">
          {history.map((item) => {
            const actorLabel = item.actor_id
              ? truncateActor(item.actor_id)
              : t("detailActor");
            return (
              <li
                key={`${item.status}-${item.created_at}-${item.actor_id ?? ""}`}
                className="rounded-md border border-border bg-secondary/50 p-4 space-y-1"
              >
                <p className="font-semibold capitalize text-foreground">
                  {item.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(item.created_at)} · {actorLabel}
                </p>
                {item.note && (
                  <p className="mt-2 text-sm text-foreground">{item.note}</p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* 7. Resolve actions */}
      <section className="space-y-3 rounded-lg border border-border p-6">
        <h2 className="text-xl font-semibold text-foreground">
          {t("detailActions")}
        </h2>
        {report.status_note && (
          <p className="text-sm text-muted-foreground">
            {t("detailLatestNote", { note: report.status_note })}
          </p>
        )}
        <StatusActions
          reportId={report.report_id}
          currentStatus={report.status}
        />
      </section>
    </div>
  );
}
