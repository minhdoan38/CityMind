"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Calendar, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import {
  FILTER_PARAM_KEYS,
  type DashboardSearchParams,
} from "./types";

const PRESET_DAYS = ["7", "30", "90"] as const;
type PresetDays = (typeof PRESET_DAYS)[number];

type Props = {
  params: DashboardSearchParams;
  className?: string;
  /** When false, only the custom range picker is shown (period presets live elsewhere). */
  showPeriodPresets?: boolean;
};

function isoDateOnly(value: string | undefined): string {
  return value?.slice(0, 10) ?? "";
}

function presetBounds(days: number): { after: string; before: string } {
  const today = new Date();
  const before = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      23,
      59,
      59,
    ),
  );
  const after = new Date(before);
  after.setUTCDate(after.getUTCDate() - (days - 1));
  after.setUTCHours(0, 0, 0, 0);
  return { after: after.toISOString(), before: before.toISOString() };
}

function detectPreset(
  after?: string,
  before?: string,
): PresetDays | "custom" | null {
  if (!after?.trim() && !before?.trim()) return null;
  for (const days of PRESET_DAYS) {
    const bounds = presetBounds(Number(days));
    if (
      isoDateOnly(after) === isoDateOnly(bounds.after) &&
      isoDateOnly(before) === isoDateOnly(bounds.before)
    ) {
      return days;
    }
  }
  return "custom";
}

function formatDisplayDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function ReportsDateRangeFilter({
  params,
  className,
  showPeriodPresets = true,
}: Props) {
  const t = useTranslations("dashboard");
  const tAnalytics = useTranslations("dashboard.analytics");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(isoDateOnly(params.created_after));
  const [customTo, setCustomTo] = useState(isoDateOnly(params.created_before));

  const activePreset = useMemo(
    () => detectPreset(params.created_after, params.created_before),
    [params.created_after, params.created_before],
  );

  useEffect(() => {
    setCustomFrom(isoDateOnly(params.created_after));
    setCustomTo(isoDateOnly(params.created_before));
  }, [params.created_after, params.created_before]);

  function currentParams(): URLSearchParams {
    const next = new URLSearchParams();
    if (params.limit) next.set("limit", params.limit);
    if (params.sort) next.set("sort", params.sort);
    if (params.order) next.set("order", params.order);
    for (const key of FILTER_PARAM_KEYS) {
      const value = params[key];
      if (value?.trim()) next.set(key, value.trim());
    }
    if (params.view?.trim()) next.set("view", params.view.trim());
    if (params.bbox?.trim()) next.set("bbox", params.bbox.trim());
    return next;
  }

  function navigate(next: URLSearchParams) {
    next.delete("cursor");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function applyDateRange(after: string, before: string) {
    const next = currentParams();
    if (after) next.set("created_after", after);
    else next.delete("created_after");
    if (before) next.set("created_before", before);
    else next.delete("created_before");
    navigate(next);
  }

  function selectPreset(days: PresetDays) {
    const bounds = presetBounds(Number(days));
    applyDateRange(bounds.after, bounds.before);
  }

  function clearRange() {
    applyDateRange("", "");
  }

  function applyCustomRange() {
    const after = customFrom ? `${customFrom}T00:00:00Z` : "";
    const before = customTo ? `${customTo}T23:59:59Z` : "";
    applyDateRange(after, before);
    setCustomOpen(false);
  }

  const rangeLabel = useMemo(() => {
    const after = params.created_after?.trim();
    const before = params.created_before?.trim();
    if (!after && !before) return t("dateRangeAll");
    const start = after
      ? formatDisplayDate(after, locale)
      : t("dateRangeOpenStart");
    const end = before
      ? formatDisplayDate(before, locale)
      : t("dateRangeOpenEnd");
    return `${start} – ${end}`;
  }, [
    locale,
    params.created_after,
    params.created_before,
    t,
  ]);

  const presetLabel = useMemo(() => {
    if (activePreset === "7") return tAnalytics("preset7");
    if (activePreset === "90") return tAnalytics("preset90");
    if (activePreset === "30") return tAnalytics("preset30");
    if (activePreset === "custom") return tAnalytics("presetCustom");
    return t("dateRangePeriod");
  }, [activePreset, t, tAnalytics]);

  const customInvalid =
    Boolean(customFrom && customTo) && customFrom > customTo;

  return (
    <div
      className={cn(
        "dash-control-surface inline-flex max-w-full items-stretch overflow-hidden shadow-[var(--shadow-card)]",
        !showPeriodPresets && "reports-date-range-compact",
        className,
      )}
    >
      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={pending}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 px-3.5 text-left sm:px-4",
              "transition-colors duration-150 hover:bg-muted/70",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
            )}
            aria-label={t("dateRangePickerAria")}
          >
            <Calendar
              className="size-4 shrink-0 text-muted-foreground"
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="truncate text-sm font-semibold text-foreground">
              {rangeLabel}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(100vw-2rem,20rem)] p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reports-range-from" className="text-sm font-medium">
                {tAnalytics("fromLabel")}
              </Label>
              <Input
                id="reports-range-from"
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="h-10 rounded-[var(--radius-control)] border-border bg-muted/30 font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reports-range-to" className="text-sm font-medium">
                {tAnalytics("toLabel")}
              </Label>
              <Input
                id="reports-range-to"
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="h-10 rounded-[var(--radius-control)] border-border bg-muted/30 font-medium"
              />
            </div>
            {customInvalid ? (
              <p className="text-sm text-destructive" role="alert">
                {tAnalytics("invalidDates")}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="font-medium"
                onClick={clearRange}
                disabled={pending}
              >
                {t("clearFilters")}
              </Button>
              <Button
                type="button"
                className="font-semibold"
                onClick={applyCustomRange}
                disabled={pending || customInvalid}
              >
                {tAnalytics("applyRange")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {showPeriodPresets ? (
        <>
          <div aria-hidden className="w-px shrink-0 self-stretch bg-border" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={pending}
                className={cn(
                  "flex shrink-0 items-center gap-2 px-3.5 sm:px-4",
                  "transition-colors duration-150 hover:bg-muted/70",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                )}
                aria-label={t("dateRangePresetAria")}
              >
                <span className="whitespace-nowrap text-sm font-semibold text-foreground">
                  {presetLabel}
                </span>
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40 border-border">
              {PRESET_DAYS.map((days) => (
                <DropdownMenuItem
                  key={days}
                  className="cursor-pointer font-medium"
                  onClick={() => selectPreset(days)}
                >
                  {days === "7"
                    ? tAnalytics("preset7")
                    : days === "90"
                      ? tAnalytics("preset90")
                      : tAnalytics("preset30")}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                className="cursor-pointer font-medium"
                onClick={() => setCustomOpen(true)}
              >
                {tAnalytics("presetCustom")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer font-medium"
                onClick={clearRange}
              >
                {t("dateRangeAll")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
    </div>
  );
}

type PeriodPresetsProps = {
  params: DashboardSearchParams;
  compact?: boolean;
};

/** Quick period presets for the filter drawer (7 / 30 / 90 days, all dates). */
export function ReportsPeriodPresets({ params, compact = false }: PeriodPresetsProps) {
  const t = useTranslations("dashboard");
  const tAnalytics = useTranslations("dashboard.analytics");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const activePreset = useMemo(
    () => detectPreset(params.created_after, params.created_before),
    [params.created_after, params.created_before],
  );

  function currentParams(): URLSearchParams {
    const next = new URLSearchParams();
    if (params.limit) next.set("limit", params.limit);
    if (params.sort) next.set("sort", params.sort);
    if (params.order) next.set("order", params.order);
    for (const key of FILTER_PARAM_KEYS) {
      const value = params[key];
      if (value?.trim()) next.set(key, value.trim());
    }
    if (params.view?.trim()) next.set("view", params.view.trim());
    if (params.bbox?.trim()) next.set("bbox", params.bbox.trim());
    return next;
  }

  function navigate(next: URLSearchParams) {
    next.delete("cursor");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function applyDateRange(after: string, before: string) {
    const next = currentParams();
    if (after) next.set("created_after", after);
    else next.delete("created_after");
    if (before) next.set("created_before", before);
    else next.delete("created_before");
    navigate(next);
  }

  function selectPreset(days: PresetDays) {
    const bounds = presetBounds(Number(days));
    applyDateRange(bounds.after, bounds.before);
  }

  function clearRange() {
    applyDateRange("", "");
  }

  const presetKey =
    activePreset === "7"
      ? "7"
      : activePreset === "30"
        ? "30"
        : activePreset === "90"
          ? "90"
          : activePreset === "custom"
            ? "custom"
            : "all";

  const toggleValue = presetKey === "custom" ? "" : presetKey;

  return (
    <div className={cn("min-w-0 space-y-2", compact && "reports-filter-field gap-1.5")}>
      <p
        className={cn(
          compact
            ? "reports-filter-group-label"
            : "font-heading text-xs font-semibold text-muted-foreground",
        )}
      >
        {t("dateRangePeriod")}
      </p>
      <ToggleGroup
        type="single"
        variant="segmented"
        size={compact ? "sm" : "default"}
        value={toggleValue}
        disabled={pending}
        onValueChange={(value) => {
          if (!value) return;
          if (value === "all") clearRange();
          else if (value === "7" || value === "30" || value === "90") {
            selectPreset(value);
          }
        }}
        aria-label={t("dateRangePresetAria")}
      >
        <ToggleGroupItem value="7">{tAnalytics("preset7")}</ToggleGroupItem>
        <ToggleGroupItem value="30">{tAnalytics("preset30")}</ToggleGroupItem>
        <ToggleGroupItem value="90">{tAnalytics("preset90")}</ToggleGroupItem>
        <ToggleGroupItem value="all">{t("dateRangeAll")}</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
