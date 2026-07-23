import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { CSSProperties, ReactNode } from "react";

import CopyStatusLink from "@/components/CopyStatusLink";
import RoutingOverrideActions from "@/components/RoutingOverrideActions";
import RoutingDestinationBadge from "@/components/reports/RoutingDestinationBadge";
import TriageStatusBadge from "@/components/reports/TriageStatusBadge";
import { formatReportIdForList } from "@/components/reports/triage-field-display";
import StatusActions from "@/components/StatusActions";
import { requireOfficerSession } from "@/lib/auth";
import { formatDashboardWhenFull } from "@/lib/dashboard-datetime";
import { cn } from "@/lib/utils";
import { loadOfficerReportDetail } from "@/server/services/officer-dashboard";
import type { ShadowComparisonRow } from "@/server/evals/shadow-service";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
  routing_destination?: string | null;
  status?: string;
  status_note?: string | null;
};

type StatusEvent = {
  status: string;
  note?: string | null;
  actor_id?: string | null;
  created_at: string;
};

const DASH_RISE_DELAYS = [
  "",
  "dash-rise-delay-1",
  "dash-rise-delay-2",
  "dash-rise-delay-3",
  "dash-rise-delay-4",
] as const;

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

function DetailSection({
  title,
  children,
  variant = "default",
  delayIndex = 0,
  className,
}: {
  title: string;
  children: ReactNode;
  variant?: "default" | "ai";
  delayIndex?: number;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "reports-detail-section surface-card dash-rise",
        DASH_RISE_DELAYS[Math.min(delayIndex, DASH_RISE_DELAYS.length - 1)],
        variant === "ai" && "reports-detail-section--ai",
        className,
      )}
    >
      <h2 className="reports-detail-section-title">{title}</h2>
      <div className="reports-detail-section-body">{children}</div>
    </section>
  );
}

function SignalList({
  items,
  emptyLabel,
}: {
  items?: string[];
  emptyLabel: string;
}) {
  if (!items?.length) {
    return <p className="reports-detail-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="reports-detail-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function shadowFieldValue(
  snapshot: Record<string, unknown> | null | undefined,
  field: "category" | "severity" | "priority",
): string {
  if (!snapshot) return "—";
  const value = snapshot[field];
  if (value == null) return "—";
  return String(value);
}

type ShadowComparisonLabels = {
  title: string;
  intro: string;
  fieldColumn: string;
  baselineColumn: string;
  candidateColumn: string;
  fieldNames: Record<"category" | "severity" | "priority", string>;
};

function ShadowComparisonPanel({
  comparison,
  delayIndex,
  labels,
}: {
  comparison: ShadowComparisonRow;
  delayIndex: number;
  labels: ShadowComparisonLabels;
}) {
  const baseline = comparison.baseline_snapshot as Record<string, unknown>;
  const candidate = comparison.candidate_snapshot as Record<string, unknown> | null;
  const fields = ["category", "severity", "priority"] as const;

  return (
    <details
      className={cn(
        "reports-detail-section surface-card dash-rise",
        DASH_RISE_DELAYS[Math.min(delayIndex, DASH_RISE_DELAYS.length - 1)],
      )}
    >
      <summary className="reports-detail-section-title cursor-pointer">
        {labels.title}
      </summary>
      <div className="reports-detail-section-body">
        <p className="reports-detail-muted">{labels.intro}</p>
        <div className="reports-detail-table-wrap">
          <table className="reports-detail-table">
            <thead>
              <tr>
                <th scope="col">{labels.fieldColumn}</th>
                <th scope="col">{labels.baselineColumn}</th>
                <th scope="col">{labels.candidateColumn}</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const disagrees = Boolean(
                  (comparison.disagreement as Record<string, unknown> | undefined)?.[
                    field
                  ],
                );
                return (
                  <tr
                    key={field}
                    className={disagrees ? "reports-detail-table-row--warn" : undefined}
                  >
                    <th scope="row" className="font-medium">
                      {labels.fieldNames[field]}
                    </th>
                    <td>{shadowFieldValue(baseline, field)}</td>
                    <td>{shadowFieldValue(candidate, field)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function resolveStatusLabel(
  status: string,
  translate: Awaited<ReturnType<typeof getTranslations>>,
): string {
  const statusKey = `status_${status}` as
    | "status_new"
    | "status_reviewing"
    | "status_resolved"
    | "status_rejected";
  return translate.has(statusKey) ? translate(statusKey) : status;
}

function formatImpactDisplay(raw: string): string {
  return raw
    .split(/\s*[—–-]\s*/)
    .map((segment) =>
      segment
        .split(/[_\s]+/)
        .filter(Boolean)
        .map(
          (word) =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" "),
    )
    .join(" · ");
}

type MetricItem = {
  key: string;
  label: string;
  labelTitle?: string;
  value: string;
  tone?: "default" | "impact";
};

function MetricStrip({ items }: { items: MetricItem[] }) {
  const core = items.filter((item) => item.tone !== "impact");
  const impact = items.find((item) => item.tone === "impact");

  return (
    <div className="reports-detail-metrics-wrap dash-rise dash-rise-delay-2">
      <div className="reports-detail-metrics surface-card">
        {core.map((item) => (
          <div key={item.key} className="reports-detail-metric">
            <dl className="reports-detail-metric-dl">
              <dt
                className="reports-detail-metric-label"
                title={item.labelTitle}
              >
                {item.label}
              </dt>
              <dd className="reports-detail-metric-value">{item.value}</dd>
            </dl>
          </div>
        ))}
      </div>
      {impact ? (
        <div className="reports-detail-impact surface-card">
          <dl className="reports-detail-metric-dl">
            <dt
              className="reports-detail-metric-label"
              title={impact.labelTitle ?? impact.label}
            >
              {impact.label}
            </dt>
            <dd className="reports-detail-impact-value text-pretty">
              {impact.value}
            </dd>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export default async function ReportDetail({ params }: Props) {
  await requireOfficerSession();
  const locale = await getLocale();
  const t = await getTranslations("dashboard");
  const tt = await getTranslations("dashboard.triage");
  const tr = await getTranslations("dashboard.routing");
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
      <Card className="reports-detail-error surface-card mx-auto max-w-4xl p-6">
        <h1 className="reports-detail-title">
          {reportResult.notFound ? t("detailNotFound") : t("detailUnavailable")}
        </h1>
        <p className="reports-detail-muted mt-2">
          {reportResult.error === "api_error"
            ? terror("apiConnection")
            : t("detailLoadError")}
        </p>
        <Link href="/dashboard" className="reports-detail-back mt-5 inline-flex">
          ← {t("detailBack")}
        </Link>
      </Card>
    );
  }

  const report = reportResult.data;
  const history = historyResult.data ?? [];
  const urbanContext = parseUrbanContext(report.urban_context);
  const triageComplete = report.triage_status === "completed";
  const statusLabel = resolveStatusLabel(report.status ?? "new", t);
  const detailTitle = triageComplete
    ? report.category || t("detailNotAvailable")
    : tt("detailPendingTitle");
  const confidenceLabels = {
    low: tt("confidenceLow"),
    medium: tt("confidenceMedium"),
    high: tt("confidenceHigh"),
    unavailable: t("detailNotAvailable"),
  };
  const isSelfHelp =
    report.routing_destination === "self_help" &&
    report.status !== "resolved" &&
    report.status !== "rejected";

  let sectionIndex = 2;

  return (
    <div className="reports-detail">
      <Link href="/dashboard" className="reports-detail-back dash-rise">
        ← {t("detailBack")}
      </Link>
      <a href="#officer-decision" className="reports-detail-skip">
        {t("detailSkipToDecision")}
      </a>

      <header className="reports-detail-hero dash-rise dash-rise-delay-1">
        <div className="reports-detail-hero-head">
          <h1
            className={cn(
              "reports-detail-title text-balance capitalize",
              triageComplete && "reports-detail-title--complete",
            )}
          >
            {detailTitle}
          </h1>
          <div className="reports-detail-meta">
            <span className="reports-detail-id font-mono" title={report.report_id}>
              {formatReportIdForList(report.report_id).display}
            </span>
            <span className="reports-detail-meta-sep" aria-hidden>
              ·
            </span>
            <time dateTime={report.created_at}>
              {t("detailSubmitted", {
                date: formatDashboardWhenFull(report.created_at, locale),
              })}
            </time>
          </div>
        </div>

        <div className="reports-detail-badges">
          <TriageStatusBadge triageStatus={report.triage_status} />
          <RoutingDestinationBadge
            destination={report.routing_destination ?? null}
          />
          <Badge variant="secondary" className="reports-detail-status-badge capitalize">
            {statusLabel}
          </Badge>
        </div>

        <p className="reports-detail-advisory">{tt("detailHelper")}</p>
        {report.routing_destination === "self_help" ? (
          <Alert role="status" className="reports-detail-self-help-alert">
            <AlertDescription>{tr("detailSelfHelpNotice")}</AlertDescription>
          </Alert>
        ) : null}
      </header>

      {triageComplete ? (
        <MetricStrip
          items={[
            {
              key: "priority",
              label: t("detailPriority"),
              value:
                report.priority != null
                  ? report.priority.charAt(0).toUpperCase() +
                    report.priority.slice(1).toLowerCase()
                  : t("detailNotAvailable"),
            },
            {
              key: "severity",
              label: t("detailSeverity"),
              value:
                report.severity != null
                  ? `${report.severity}/5`
                  : t("detailNotAvailable"),
            },
            {
              key: "confidence",
              label: tt("confidenceLabelShort"),
              labelTitle: tt("confidenceLabel"),
              value: confidenceBand(report.confidence, confidenceLabels),
            },
            {
              key: "impact",
              label: t("detailImpact"),
              value: report.estimated_impact
                ? formatImpactDisplay(report.estimated_impact)
                : t("detailNotAvailable"),
              tone: "impact",
            },
          ]}
        />
      ) : null}

      <div className="reports-detail-grid">
        <aside
          id="officer-decision"
          className="reports-detail-aside dash-rise dash-rise-delay-3"
          aria-labelledby="officer-decision-title"
        >
          <div className="reports-detail-aside-card surface-card">
            <h2 id="officer-decision-title" className="reports-detail-aside-title">
              {t("detailActions")}
            </h2>
            {report.status_note ? (
              <p className="reports-detail-muted">
                {t("detailLatestNote", { note: report.status_note })}
              </p>
            ) : null}
            <StatusActions
              reportId={report.report_id}
              currentStatus={report.status}
              stacked
            />
            <div className="reports-detail-aside-tools">
              <h3 className="reports-detail-aside-tools-title">
                {t("detailAsideShare")}
              </h3>
              <CopyStatusLink reportId={report.report_id} embedded />
              <Link
                href={`/dashboard/agent-console?report_id=${encodeURIComponent(report.report_id)}`}
                className="reports-detail-link reports-detail-aside-console-link"
              >
                {tt("detailAgentConsoleLink")}
              </Link>
            </div>
          </div>
        </aside>

        <div className="reports-detail-main">
          {report.description ? (
            <DetailSection
              title={t("detailCitizen")}
              delayIndex={sectionIndex++}
            >
              <p className="reports-detail-prose whitespace-pre-wrap">
                {report.description}
              </p>
            </DetailSection>
          ) : null}

          {report.evidence_path ? (
            <DetailSection
              title={t("detailEvidenceImage")}
              delayIndex={sectionIndex++}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/officer/reports/${report.report_id}/image`}
                alt={
                  report.category
                    ? t("detailEvidenceAlt", { category: report.category })
                    : t("detailEvidenceAltGeneric")
                }
                className="reports-detail-evidence"
              />
            </DetailSection>
          ) : null}

          {isSelfHelp ? (
            <div className="dash-rise" style={{ animationDelay: `${sectionIndex * 40}ms` }}>
              <RoutingOverrideActions reportId={report.report_id} />
            </div>
          ) : null}

          {triageComplete && report.evidence?.length ? (
            <DetailSection
              title={tt("observedFacts")}
              delayIndex={sectionIndex++}
            >
              <SignalList
                items={report.evidence}
                emptyLabel={t("detailNoneRecorded")}
              />
            </DetailSection>
          ) : null}

          {triageComplete && report.uncertainty?.length ? (
            <DetailSection title={tt("unknowns")} delayIndex={sectionIndex++}>
              <SignalList
                items={report.uncertainty}
                emptyLabel={t("detailNoneRecorded")}
              />
            </DetailSection>
          ) : null}

          {triageComplete ? (
            <DetailSection
              title={t("detailAiTitle")}
              variant="ai"
              delayIndex={sectionIndex++}
            >
              <Alert className="reports-detail-ai-alert">
                <AlertDescription>{t("detailAiDisclaimer")}</AlertDescription>
              </Alert>
              {report.summary ? (
                <div className="reports-detail-field">
                  <h3 className="reports-detail-field-label">{t("detailSummary")}</h3>
                  <p className="reports-detail-prose">{report.summary}</p>
                </div>
              ) : null}
              {report.recommendation ? (
                <div className="reports-detail-field">
                  <h3 className="reports-detail-field-label">
                    {t("detailRecommendation")}
                  </h3>
                  <p className="reports-detail-prose">{report.recommendation}</p>
                </div>
              ) : null}
            </DetailSection>
          ) : null}

          {detail.shadowComparison ? (
            <ShadowComparisonPanel
              comparison={detail.shadowComparison}
              delayIndex={sectionIndex++}
              labels={{
                title: tt("shadowComparisonTitle"),
                intro: tt("shadowComparisonIntro", {
                  model: detail.shadowComparison.candidate_model,
                }),
                fieldColumn: tt("shadowColumnField"),
                baselineColumn: tt("shadowColumnBaseline"),
                candidateColumn: tt("shadowColumnCandidate"),
                fieldNames: {
                  category: tt("shadowFieldCategory"),
                  severity: tt("shadowFieldSeverity"),
                  priority: tt("shadowFieldPriority"),
                },
              }}
            />
          ) : null}

          {(report.latitude != null || report.longitude != null) && (
            <DetailSection
              title={t("detailLocation")}
              delayIndex={sectionIndex++}
            >
              <p className="reports-detail-prose tabular-nums">
                {report.latitude ?? t("detailNotAvailable")},{" "}
                {report.longitude ?? t("detailNotAvailable")}
              </p>
            </DetailSection>
          )}

          {urbanContext && Object.keys(urbanContext).length > 0 ? (
          <DetailSection title={t("detailUrban")} delayIndex={sectionIndex++}>
            <p className="reports-detail-muted">{t("detailUrbanHelper")}</p>
            <pre className="reports-detail-code">
              {JSON.stringify(urbanContext, null, 2)}
            </pre>
          </DetailSection>
          ) : null}

          {historyResult.error || history.length > 0 ? (
          <DetailSection title={t("detailTimeline")} delayIndex={sectionIndex++}>
            {historyResult.error ? (
              <Alert variant="destructive">
                <AlertDescription>{t("detailHistoryError")}</AlertDescription>
              </Alert>
            ) : (
            <ol className="reports-detail-timeline">
              {history.map((item, index) => {
                const actorLabel = item.actor_id
                  ? truncateActor(item.actor_id)
                  : t("detailActor");
                const eventStatusLabel = resolveStatusLabel(item.status, t);
                return (
                  <li
                    key={`${item.status}-${item.created_at}-${item.actor_id ?? ""}`}
                    className="reports-detail-timeline-item preview-section-rise"
                    style={{ "--preview-i": index } as CSSProperties}
                  >
                    <p className="reports-detail-timeline-status">
                      {eventStatusLabel}
                    </p>
                    <p className="reports-detail-timeline-meta tabular-nums">
                      {formatDashboardWhenFull(item.created_at, locale)} ·{" "}
                      {actorLabel}
                    </p>
                    {item.note ? (
                      <p className="reports-detail-timeline-note">{item.note}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            )}
          </DetailSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}
