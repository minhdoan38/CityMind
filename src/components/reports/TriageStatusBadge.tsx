"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  triageStatus: string;
  className?: string;
  /** Dense table cell: icon or abbreviated label with full text in aria-label. */
  compact?: boolean;
};

export function triageVariant(
  triageStatus: string,
): "outline" | "secondary" | "elevated" {
  if (triageStatus === "manual_review" || triageStatus === "failed") {
    return "elevated";
  }
  if (triageStatus === "completed") return "secondary";
  return "outline";
}

export default function TriageStatusBadge({
  triageStatus,
  className,
  compact = false,
}: Props) {
  const t = useTranslations("dashboard.triage");
  const variant = triageVariant(triageStatus);

  let fullLabel = t("badgePending");
  let shortLabel = t("badgePendingShort");
  if (variant === "elevated") {
    fullLabel = t("badgeElevated");
    shortLabel = t("badgeElevatedShort");
  } else if (variant === "secondary") {
    fullLabel = t("badgeComplete");
    shortLabel = t("badgeCompleteShort");
  }

  const badgeVariant =
    compact && variant === "secondary"
      ? "default"
      : variant === "elevated"
        ? "outline"
        : variant;

  return (
    <Badge
      variant={badgeVariant}
      aria-label={compact ? fullLabel : undefined}
      title={compact ? fullLabel : undefined}
      className={cn(
        "gap-1 capitalize",
        compact && "h-4 gap-0.5 px-1.5 py-0 text-[10px] font-semibold",
        variant === "elevated" &&
          "border-amber-500/50 bg-amber-50 text-amber-900",
        className,
      )}
    >
      {compact ? (
        variant === "outline" ? (
          <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
        ) : variant === "secondary" ? (
          <Check className="size-3 shrink-0" aria-hidden />
        ) : (
          shortLabel
        )
      ) : (
        <>
          {variant === "outline" ? (
            <Loader2 className="size-3.5 shrink-0" aria-hidden />
          ) : null}
          {fullLabel}
        </>
      )}
    </Badge>
  );
}
