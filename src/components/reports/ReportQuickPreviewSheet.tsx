"use client";

import type { CSSProperties, ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDashboardWhenFull } from "@/lib/dashboard-datetime";
import { cn } from "@/lib/utils";

import ReportThumbnail from "./ReportThumbnail";
import RoutingDestinationBadge from "./RoutingDestinationBadge";
import ShadowMismatchBadge from "./ShadowMismatchBadge";
import TriageStatusBadge from "./TriageStatusBadge";
import { triageFieldPlaceholderKey } from "./triage-field-display";
import type { ReportRow } from "./types";

type Props = {
  report: ReportRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowDetail: (reportId: string) => void;
};

function previewSectionStyle(index: number): CSSProperties {
  return { "--preview-i": index } as CSSProperties;
}

function statusVariant(
  status: string,
): "secondary" | "outline" | "default" | "destructive" {
  switch (status) {
    case "resolved":
      return "default";
    case "rejected":
      return "destructive";
    case "reviewing":
      return "outline";
    default:
      return "secondary";
  }
}

function PreviewFieldValue({
  value,
  triageStatus,
  fallback,
  className,
}: {
  value: string;
  triageStatus: string;
  fallback: string;
  className?: string;
}) {
  const tt = useTranslations("dashboard.triage");
  const placeholderKey = triageFieldPlaceholderKey(triageStatus, value);
  if (!placeholderKey) {
    return <span className={className}>{value.trim()}</span>;
  }
  const copyByKey = {
    pending: tt("cellPending"),
    processing: tt("cellProcessing"),
    failed: tt("cellFailed"),
    manualReview: tt("cellManualReview"),
    empty: fallback,
  } as const;
  return (
    <span className={cn("font-medium text-muted-foreground", className)}>
      {copyByKey[placeholderKey]}
    </span>
  );
}

function MetaItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium leading-none text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-semibold leading-snug text-foreground">
        {children}
      </dd>
    </div>
  );
}

export default function ReportQuickPreviewSheet({
  report,
  open,
  onOpenChange,
  onShowDetail,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const tt = useTranslations("dashboard.triage");

  if (!report) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="hidden" />
      </Sheet>
    );
  }

  const statusKey = `status_${report.status}` as
    | "status_new"
    | "status_reviewing"
    | "status_resolved"
    | "status_rejected";
  const statusLabel = t(statusKey);
  const categoryReady =
    triageFieldPlaceholderKey(report.triage_status, report.category) === null;
  const summaryReady =
    triageFieldPlaceholderKey(report.triage_status, report.summary) === null;
  const headline = categoryReady
    ? report.category.trim()
    : tt("detailPendingTitle");
  const submittedAt = formatDashboardWhenFull(report.created_at, locale);
  let sectionIndex = 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        overlayClassName="bg-black/45 backdrop-blur-sm duration-200 motion-reduce:backdrop-blur-none"
        className={cn(
          "flex w-full flex-col gap-0 p-0 sm:max-w-md lg:max-w-[30rem]",
          "data-[side=right]:border-l data-[side=right]:border-border",
        )}
      >
        <header className="shrink-0 border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("colReportId")}
                </p>
                <p className="break-all font-mono text-xs leading-relaxed text-foreground/80">
                  {report.report_id}
                </p>
              </div>
              <div className="space-y-1.5">
                <SheetTitle className="font-heading text-xl font-semibold capitalize leading-tight tracking-tight text-foreground text-balance">
                  {headline}
                </SheetTitle>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {t("detailSubmitted", { date: submittedAt })}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => onOpenChange(false)}
              aria-label={t("previewClose")}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          {report.evidence_path ? (
            <section
              className="preview-section-rise overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted/20"
              style={previewSectionStyle(sectionIndex++)}
            >
              <div className="aspect-[5/3] w-full">
                <ReportThumbnail
                  reportId={report.report_id}
                  evidencePath={report.evidence_path}
                  category={report.category}
                  className="size-full rounded-none border-0 bg-transparent"
                />
              </div>
            </section>
          ) : null}

          <section
            className="preview-section-rise flex flex-wrap items-center gap-2"
            style={previewSectionStyle(sectionIndex++)}
          >
            <TriageStatusBadge triageStatus={report.triage_status} />
            <RoutingDestinationBadge destination={report.routing_destination ?? null} />
            <Badge variant={statusVariant(report.status)} className="capitalize">
              {statusLabel}
            </Badge>
            {report.priority ? (
              <Badge variant="outline" className="capitalize">
                {report.priority}
              </Badge>
            ) : null}
            {report.has_shadow_disagreement ? (
              <ShadowMismatchBadge hasDisagreement />
            ) : null}
          </section>

          <section
            className="preview-section-rise"
            style={previewSectionStyle(sectionIndex++)}
          >
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
              <MetaItem label={t("colCategory")}>
                <span className="capitalize">
                  <PreviewFieldValue
                    value={report.category}
                    triageStatus={report.triage_status}
                    fallback={t("detailNotAvailable")}
                  />
                </span>
              </MetaItem>
              <MetaItem label={t("colSeverity")}>
                {report.severity == null ? (
                  <PreviewFieldValue
                    value=""
                    triageStatus={report.triage_status}
                    fallback={t("detailNotAvailable")}
                  />
                ) : (
                  <span className="tabular-nums">{String(report.severity)}</span>
                )}
              </MetaItem>
              <MetaItem label={t("colStatus")}>{statusLabel}</MetaItem>
            </dl>
          </section>

          <section
            className="preview-section-rise rounded-[var(--radius-card)] border border-border bg-primary/5 px-4 py-4"
            style={previewSectionStyle(sectionIndex++)}
          >
            <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
              {t("previewSummary")}
            </h3>
            <p className="mt-3 text-base leading-relaxed text-foreground text-pretty">
              {summaryReady ? (
                report.summary.trim() || t("detailNotAvailable")
              ) : (
                <PreviewFieldValue
                  value={report.summary}
                  triageStatus={report.triage_status}
                  fallback={t("detailNotAvailable")}
                  className="text-base font-medium"
                />
              )}
            </p>
            <p className="mt-4 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
              {t("previewAdvisory")}
            </p>
          </section>
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-5 py-4">
          <Button
            type="button"
            className="min-h-10 w-full gap-2 font-semibold"
            onClick={() => onShowDetail(report.report_id)}
          >
            {t("previewShowDetail")}
            <ArrowUpRight className="size-4" aria-hidden />
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
