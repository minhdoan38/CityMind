"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { AnalyticsSearchParams } from "./types";

const PRESETS = ["7", "30", "90"] as const;

type Props = {
  params: AnalyticsSearchParams;
  invalid?: boolean;
};

export default function DateRangeToolbar({ params, invalid }: Props) {
  const t = useTranslations("dashboard.analytics");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const activeRange = params.range?.trim() || "30";
  const [customFrom, setCustomFrom] = useState(params.from ?? "");
  const [customTo, setCustomTo] = useState(params.to ?? "");

  useEffect(() => {
    setCustomFrom(params.from ?? "");
    setCustomTo(params.to ?? "");
  }, [params.from, params.to]);

  function navigate(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function selectPreset(preset: string) {
    const next = new URLSearchParams();
    next.set("range", preset);
    navigate(next);
  }

  function applyCustom() {
    const next = new URLSearchParams();
    next.set("range", "custom");
    if (customFrom) next.set("from", customFrom);
    if (customTo) next.set("to", customTo);
    navigate(next);
  }

  const presetLabel = (preset: (typeof PRESETS)[number]) => {
    if (preset === "7") return t("preset7");
    if (preset === "90") return t("preset90");
    return t("preset30");
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant={activeRange === preset ? "default" : "outline"}
            className="min-h-11"
            onClick={() => selectPreset(preset)}
            disabled={pending}
            aria-pressed={activeRange === preset}
          >
            {presetLabel(preset)}
          </Button>
        ))}
        <Button
          type="button"
          variant={activeRange === "custom" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => selectPreset("custom")}
          disabled={pending}
          aria-pressed={activeRange === "custom"}
        >
          {t("presetCustom")}
        </Button>
      </div>

      {activeRange === "custom" && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="analytics-from">{t("fromLabel")}</Label>
            <Input
              id="analytics-from"
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="min-h-11"
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="analytics-to">{t("toLabel")}</Label>
            <Input
              id="analytics-to"
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="min-h-11"
            />
          </div>
          <Button
            type="button"
            className="min-h-11"
            onClick={applyCustom}
            disabled={pending}
          >
            {t("applyRange")}
          </Button>
        </div>
      )}

      {invalid && (
        <p className="text-sm text-destructive" role="alert">
          {t("invalidDates")}
        </p>
      )}
    </div>
  );
}
