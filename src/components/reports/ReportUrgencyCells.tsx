"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  confidenceBand,
  formatReportAge,
  getSlaUrgency,
  priorityTone,
  severityTone,
  type SlaUrgency,
} from "@/lib/report-row-urgency";
import { cn } from "@/lib/utils";

import { triageFieldPlaceholderKey } from "./triage-field-display";
import type { ReportRow } from "./types";

const ELIGIBLE_TRIAGE = new Set(["pending", "failed", "retry"]);

type SeverityProps = {
  severity: number | null | undefined;
  triageStatus: string;
  compact?: boolean;
};

export function ReportSeverityBadge({
  severity,
  triageStatus,
  compact = false,
}: SeverityProps) {
  const t = useTranslations("dashboard");
  const placeholder = triageFieldPlaceholderKey(triageStatus, severity == null ? "" : String(severity));
  if (placeholder) {
    return (
      <span
        className={cn(
          "reports-severity-badge reports-severity-badge--idle",
          compact && "reports-severity-badge--compact",
        )}
        aria-label={t("severityPending")}
      >
        —
      </span>
    );
  }

  const tone = severityTone(severity);
  return (
    <span
      className={cn(
        "reports-severity-badge",
        `reports-severity-badge--${tone}`,
        compact && "reports-severity-badge--compact",
      )}
      title={t("colSeverity")}
      aria-label={`${t("colSeverity")} ${severity}`}
    >
      {severity}
    </span>
  );
}

type PriorityProps = {
  priority: string;
  triageStatus: string;
};

export function ReportPriorityBadge({ priority, triageStatus }: PriorityProps) {
  const placeholder = triageFieldPlaceholderKey(triageStatus, priority);
  if (placeholder) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const tone = priorityTone(priority);
  const label = priority.trim();
  if (!label) return <span className="text-sm text-muted-foreground">—</span>;

  return (
    <span className={cn("reports-priority-badge", `reports-priority-badge--${tone}`)}>
      {label}
    </span>
  );
}

type StatusProps = {
  status: string;
  label: string;
};

export function ReportStatusBadge({ status, label }: StatusProps) {
  return (
    <span
      className={cn(
        "reports-status-badge",
        status === "new" && "reports-status-badge--new",
        status === "reviewing" && "reports-status-badge--reviewing",
        status === "resolved" && "reports-status-badge--resolved",
        status === "rejected" && "reports-status-badge--rejected",
      )}
    >
      {label}
    </span>
  );
}

type ConfidenceProps = {
  confidence: number | null | undefined;
  triageStatus: string;
};

export function ReportConfidenceChip({ confidence, triageStatus }: ConfidenceProps) {
  const t = useTranslations("dashboard");
  const tt = useTranslations("dashboard.triage");
  const placeholder = triageFieldPlaceholderKey(
    triageStatus,
    confidence == null ? "" : String(confidence),
  );
  if (placeholder) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const band = confidenceBand(confidence);
  if (!band) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const label =
    band === "low"
      ? tt("confidenceLow")
      : band === "medium"
        ? tt("confidenceMedium")
        : tt("confidenceHigh");

  return (
    <span
      className={cn(
        "reports-confidence-chip",
        band === "low" && "reports-confidence-chip--low",
        band === "medium" && "reports-confidence-chip--medium",
        band === "high" && "reports-confidence-chip--high",
      )}
      title={t("colConfidence")}
    >
      {label}
    </span>
  );
}

type AgeSlaProps = {
  createdAt: string;
  priority: string;
  status: string;
};

function slaLabel(
  urgency: SlaUrgency,
  t: ReturnType<typeof useTranslations<"dashboard">>,
): string | null {
  if (urgency === "closed") return null;
  if (urgency === "overdue") return t("slaOverdueShort");
  if (urgency === "due") return t("slaDueShort");
  return t("slaOkShort");
}

export function ReportAgeSla({ createdAt, priority, status }: AgeSlaProps) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const age = formatReportAge(createdAt, locale);
  const urgency = getSlaUrgency({ created_at: createdAt, priority, status });
  const sla = slaLabel(urgency, t);

  return (
    <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
      <span className="whitespace-nowrap text-sm font-medium tabular-nums text-foreground">
        {age}
      </span>
      {sla ? (
        <span
          className={cn(
            "reports-sla-chip",
            urgency === "overdue" && "reports-sla-chip--overdue",
            urgency === "due" && "reports-sla-chip--due",
            urgency === "ok" && "reports-sla-chip--ok",
          )}
        >
          {sla}
        </span>
      ) : null}
    </div>
  );
}

type QuickActionsProps = {
  report: ReportRow;
  onOpenDetail: (reportId: string) => void;
  triageSlot?: ReactNode;
};

export function ReportRowQuickActions({
  report,
  onOpenDetail,
  triageSlot,
}: QuickActionsProps) {
  const t = useTranslations("dashboard");
  const canTriage = ELIGIBLE_TRIAGE.has(report.triage_status);

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-150 ease-[var(--ease-out-expo)]",
        "group-hover:opacity-100 group-focus-within:opacity-100",
        canTriage && "opacity-100",
      )}
      data-stop-row-click=""
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetail(report.report_id);
            }}
            aria-label={t("openReportDetail")}
          >
            <ArrowUpRight className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{t("openReportDetail")}</TooltipContent>
      </Tooltip>
      {triageSlot}
    </div>
  );
}
