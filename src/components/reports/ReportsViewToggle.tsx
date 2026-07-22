"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

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
      className="inline-flex rounded-xl border border-border bg-muted/60 p-1"
      role="group"
      aria-label={t("tableView")}
    >
      <Button
        type="button"
        variant={activeView === "table" ? "default" : "ghost"}
        className="min-h-11 px-4"
        aria-pressed={activeView === "table"}
        disabled={pending}
        onClick={() => setView("table")}
      >
        {t("tableView")}
      </Button>
      <Button
        type="button"
        variant={activeView === "map" ? "default" : "ghost"}
        className="min-h-11 px-4"
        aria-pressed={activeView === "map"}
        disabled={pending}
        onClick={() => setView("map")}
      >
        {t("mapView")}
      </Button>
    </div>
  );
}
