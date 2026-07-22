"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  triageStatus: string;
  className?: string;
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

export default function TriageStatusBadge({ triageStatus, className }: Props) {
  const t = useTranslations("dashboard.triage");
  const variant = triageVariant(triageStatus);

  let label = t("badgePending");
  if (variant === "elevated") {
    label = t("badgeElevated");
  } else if (variant === "secondary") {
    label = t("badgeComplete");
  }

  return (
    <Badge
      variant={variant === "elevated" ? "outline" : variant}
      className={cn(
        "gap-1 capitalize",
        variant === "elevated" &&
          "border-amber-500/50 bg-amber-50 text-amber-900",
        className,
      )}
    >
      {variant === "outline" ? (
        <Loader2 className="size-3.5 shrink-0" aria-hidden />
      ) : null}
      {label}
    </Badge>
  );
}
