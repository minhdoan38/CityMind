"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function routingVariant(
  destination: string | null,
): "outline" | "secondary" {
  if (destination === "self_help") return "secondary";
  return "outline";
}

export default function RoutingDestinationBadge({
  destination,
  className,
}: {
  destination: string | null;
  className?: string;
}) {
  const t = useTranslations("dashboard.routing");
  if (!destination) return <span aria-hidden>—</span>;
  const label =
    destination === "self_help" ? t("badgeSelfHelp") : t("badgeGovernment");
  return (
    <Badge variant={routingVariant(destination)} className={cn("capitalize", className)}>
      {label}
    </Badge>
  );
}
