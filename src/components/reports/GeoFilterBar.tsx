"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type Props = {
  drawMode: boolean;
  hasActiveBbox: boolean;
  onToggleDraw: () => void;
  onClear: () => void;
};

export default function GeoFilterBar({
  drawMode,
  hasActiveBbox,
  onToggleDraw,
  onClear,
}: Props) {
  const t = useTranslations("dashboard.map");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-sm">
      <span className="text-sm text-muted-foreground">
        {hasActiveBbox ? t("geoFilterActive") : t("geoFilterInactive")}
      </span>
      <Button
        type="button"
        variant={drawMode ? "default" : "outline"}
        className="min-h-10"
        aria-pressed={drawMode}
        onClick={onToggleDraw}
      >
        {t("drawArea")}
      </Button>
      {hasActiveBbox ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-10"
          onClick={onClear}
        >
          {t("clearAreaFilter")}
        </Button>
      ) : null}
    </div>
  );
}
