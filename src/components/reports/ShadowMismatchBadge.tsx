"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function shadowMismatchVariant(
  hasDisagreement: boolean,
): "outline" | "secondary" {
  return hasDisagreement ? "outline" : "secondary";
}

export default function ShadowMismatchBadge({
  hasDisagreement,
  className,
}: {
  hasDisagreement: boolean;
  className?: string;
}) {
  if (!hasDisagreement) {
    return <span aria-hidden>—</span>;
  }

  return (
    <Badge
      variant={shadowMismatchVariant(hasDisagreement)}
      className={cn(
        "border-amber-500/50 bg-amber-50 text-amber-900 capitalize",
        className,
      )}
    >
      Shadow mismatch
    </Badge>
  );
}
