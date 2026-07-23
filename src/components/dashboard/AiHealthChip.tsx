"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AiHealthStatus = "up" | "degraded" | "down";

export default function AiHealthChip({ className }: { className?: string }) {
  const t = useTranslations("dashboard.aiHealth");
  const [status, setStatus] = useState<AiHealthStatus | "loading">("loading");
  const [model, setModel] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/health/ai");
        const data = (await res.json()) as { status?: AiHealthStatus; model?: string };
        if (!cancelled) {
          setStatus(data.status ?? "down");
          setModel(data.model ?? "");
        }
      } catch {
        if (!cancelled) setStatus("down");
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (status === "loading") {
    return <Skeleton className="h-9 w-28 rounded-full" />;
  }

  const label =
    status === "up" ? t("up") : status === "degraded" ? t("degraded") : t("down");

  return (
    <Badge
      variant="outline"
      title={model ? t("modelLabel", { model }) : undefined}
      className={cn(
        "min-h-9 gap-2 px-3 py-1.5 text-sm font-medium",
        status === "up" && "border-emerald-500/40 bg-emerald-50 text-emerald-900",
        status === "degraded" && "border-amber-500/40 bg-amber-50 text-amber-900",
        status === "down" && "border-red-500/40 bg-red-50 text-red-900",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          status === "up" && "bg-emerald-600",
          status === "degraded" && "bg-amber-600",
          status === "down" && "bg-red-600",
        )}
      />
      {label}
    </Badge>
  );
}
