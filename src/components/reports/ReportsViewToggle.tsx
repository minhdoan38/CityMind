"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

export default function ReportsViewToggle() {
  const t = useTranslations("dashboard.map");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const activeView = searchParams.get("view") === "map" ? "map" : "table";

  function setView(view: "table" | "map") {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("cursor");
    if (view === "map") {
      next.set("view", "map");
    } else {
      next.delete("view");
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div
      className="dash-segmented"
      role="group"
      aria-label={t("tableView")}
    >
      {(["table", "map"] as const).map((view) => {
        const active = activeView === view;
        const label = view === "table" ? t("tableView") : t("mapView");
        return (
          <button
            key={view}
            type="button"
            className={cn(
              "inline-flex h-10 min-h-10 items-center rounded-[calc(var(--radius-control)-2px)] px-4 text-sm font-semibold transition-colors duration-150 ease-[var(--ease-out-expo)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              "disabled:pointer-events-none disabled:opacity-50",
              active
                ? "dash-selected border-transparent"
                : "border border-transparent text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
            disabled={pending}
            onClick={() => setView(view)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
