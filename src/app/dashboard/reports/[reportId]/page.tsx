import Link from "next/link";
import { getTranslations } from "next-intl/server";

import CopyStatusLink from "@/components/CopyStatusLink";
import TriageStatusBadge from "@/components/reports/TriageStatusBadge";
import StatusActions from "@/components/StatusActions";
import { requireOfficerSession } from "@/lib/auth";
import { loadOfficerReportDetail } from "@/server/services/officer-dashboard";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = { params: Promise<{ reportId: string }> };

type Report = {
  report_id: string;
  created_at: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  severity?: number | null;
  confidence?: number | null;
  summary?: string | null;
  recommendation?: string | null;
  priority?: string | null;
  estimated_impact?: string | null;
  evidence?: string[];
  uncertainty?: string[];
  urban_context?: string | Record<string, unknown> | null;
  evidence_path?: string | null;
  triage_status: string;
  status?: string;
  status_note?: string | null;
};

type StatusEvent = {
  status: string;
  note?: string | null;
  actor_id?: string | null;
  created_at: string;
};

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

function confidenceBand(
  confidence: number | null | undefined,
  labels: { low: string; medium: string; high: string; unavailable: string },
): string {
  if (confidence == null || Number.isNaN(confidence)) return labels.unavailable;
  if (confidence < 0.34) return labels.low;
  if (confidence < 0.67) return labels.medium;
  return labels.high;
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
  const tt = await getTranslations("dashboard.triage");
  const terror = await getTranslations("error");
  const { reportId } = await params;
  const detail = await loadOfficerReportDetail(reportId);
  const reportResult = {
    data: detail.report as Report | null,
    error: detail.error,
    notFound: detail.error === "not_found",
  };
  const historyResult = {
    data: detail.history as StatusEvent[],
    error: detail.error ? "history_error" : null,
  };

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
  const triageComplete = report.triage_status === "completed";
  const statusKey = `status_${report.status ?? "new"}` as
    | "status_new"
    | "status_reviewing"
    | "status_resolved"
    | "status_rejected";
  const statusLabel = t.has(statusKey)
    ? t(statusKey)
    : (report.status ?? "new");
  const detailTitle = triageComplete
    ? report.category || t("detailNotAvailable")
    : tt("detailPendingTitle");
  const confidenceLabels = {
    low: tt("confidenceLow"),
    medium: tt("confidenceMedium"),
    high: tt("confidenceHigh"),
    unavailable: t("detailNotAvailable"),
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href="/dashboard"
        className="text-sm font-semibold text-primary hover:underline"
      >
        ← {t("detailBack")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className={
              triageComplete
                ? "text-[1.75rem] font-semibold capitalize tracking-tight text-foreground"
                : "text-xl font-semibold tracking-tight text-foreground"
            }
          >
            {detailTitle}
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

      {report.description ? (
        <section className="space-y-2 rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {t("detailCitizen")}
          </h2>
          <p className="whitespace-pre-wrap text-base text-foreground">
            {report.description}
          </p>
        </section>
      ) : null}

      {report.evidence_path ? (
        <section className="space-y-2 rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {t("detailEvidenceImage")}
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/officer/reports/${report.report_id}/image`}
            alt="Citizen-provided report evidence"
            className="max-h-96 rounded-md border border-border object-contain"
          />
        </section>
      ) : null}

      <section className="space-y-2 rounded-lg border border-border p-6">
        <TriageStatusBadge triageStatus={report.triage_status} />
        <p className="text-sm text-muted-foreground">{tt("detailHelper")}</p>
      </section>

      {triageComplete && report.evidence?.length ? (
        <section className="space-y-2 rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {tt("observedFacts")}
          </h2>
          <SignalList
            items={report.evidence}
            emptyLabel={t("detailNoneRecorded")}
          />
        </section>
      ) : null}

      {triageComplete && report.uncertainty?.length ? (
        <section className="space-y-2 rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {tt("unknowns")}
          </h2>
          <SignalList
            items={report.uncertainty}
            emptyLabel={t("detailNoneRecorded")}
          />
        </section>
      ) : null}

      {triageComplete ? (
        <section className="space-y-4 rounded-lg border border-border bg-[#EFF6FF] p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {t("detailAiTitle")}
          </h2>
          <Alert className="border border-border bg-background/80">
            <AlertDescription className="text-sm text-foreground">
              {t("detailAiDisclaimer")}
            </AlertDescription>
          </Alert>
          {report.summary ? (
            <div className="space-y-2">
              <h3 className="text-sm font-normal text-muted-foreground">
                {t("detailSummary")}
              </h3>
              <p className="text-base text-foreground">{report.summary}</p>
            </div>
          ) : null}
          {report.recommendation ? (
            <div className="space-y-2">
              <h3 className="text-sm font-normal text-muted-foreground">
                {t("detailRecommendation")}
              </h3>
              <p className="text-base text-foreground">{report.recommendation}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {triageComplete ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 rounded-lg border border-border bg-secondary/40 p-4">
          {[
            [t("detailPriority"), report.priority ?? t("detailNotAvailable")],
            [
              t("detailSeverity"),
              report.severity != null ? `${report.severity}/5` : t("detailNotAvailable"),
            ],
            [
              tt("confidenceLabel"),
              confidenceBand(report.confidence, confidenceLabels),
            ],
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
      ) : null}

      {(report.latitude != null || report.longitude != null) && (
        <section className="space-y-1 rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {t("detailLocation")}
          </h2>
          <p className="text-sm text-foreground">
            Latitude: {report.latitude ?? t("detailNotAvailable")} · Longitude:{" "}
            {report.longitude ?? t("detailNotAvailable")}
          </p>
        </section>
      )}

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
                {item.note ? (
                  <p className="mt-2 text-sm text-foreground">{item.note}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-6">
        <h2 className="text-xl font-semibold text-foreground">
          {t("detailActions")}
        </h2>
        {report.status_note ? (
          <p className="text-sm text-muted-foreground">
            {t("detailLatestNote", { note: report.status_note })}
          </p>
        ) : null}
        <StatusActions
          reportId={report.report_id}
          currentStatus={report.status}
        />
      </section>
    </div>
  );
}
