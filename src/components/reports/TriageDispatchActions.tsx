"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { readTriageErrorDetail, formatReportIdForList } from "@/components/reports/triage-field-display";
import { cn } from "@/lib/utils";

const ELIGIBLE = new Set(["pending", "failed", "retry"]);

export type TriageDispatchResult = {
  reportId: string;
  ok: boolean;
  message: string;
};

type Props = {
  reportId: string;
  triageStatus: string;
  compact?: boolean;
  onResult?: (result: TriageDispatchResult) => void;
};

function mapDispatchError(
  detail: string | null,
  t: ReturnType<typeof useTranslations<"dashboard.triage">>,
): string {
  if (!detail) return t("runNowFailed");
  const lower = detail.toLowerCase();
  if (lower.includes("already completed")) return t("runNowAlreadyCompleted");
  if (lower.includes("not eligible")) return t("runNowIneligible");
  if (lower.includes("not found")) return t("runNowNotFound");
  return t("runNowFailed");
}

export default function TriageDispatchActions({
  reportId,
  triageStatus,
  compact = false,
  onResult,
}: Props) {
  const router = useRouter();
  const t = useTranslations("dashboard.triage");
  const [loading, setLoading] = useState(false);

  if (!ELIGIBLE.has(triageStatus)) {
    return null;
  }

  async function runTriage(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch(`/api/officer/reports/${reportId}/triage`, {
        method: "POST",
      });
      if (!res.ok) {
        const detail = await readTriageErrorDetail(res);
        const message = mapDispatchError(detail, t);
        onResult?.({ reportId, ok: false, message });
        return;
      }
      onResult?.({
        reportId,
        ok: true,
        message: t("runNowSuccess", {
          reportId: formatReportIdForList(reportId).display,
        }),
      });
      router.refresh();
    } catch {
      const message = t("runNowFailed");
      onResult?.({ reportId, ok: false, message });
    } finally {
      setLoading(false);
    }
  }

  const label = loading ? t("runNowLoading") : t("runNow");

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(
              "size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 ease-[var(--ease-out-expo)]",
              "group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
              loading && "opacity-100",
            )}
            disabled={loading}
            onClick={(event) => void runTriage(event)}
            aria-label={label}
            data-stop-row-click=""
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-8"
      disabled={loading}
      onClick={(event) => void runTriage(event)}
      data-stop-row-click=""
    >
      {loading ? (
        <>
          <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
          {t("runNowLoading")}
        </>
      ) : (
        t("runNow")
      )}
    </Button>
  );
}
