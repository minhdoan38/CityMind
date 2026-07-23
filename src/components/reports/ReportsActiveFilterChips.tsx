"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";

import {
  clearActiveFilterChip,
  listActiveFilterChips,
  type ActiveFilterChip,
} from "@/lib/active-filter-chips";
import { cn } from "@/lib/utils";

import type { DashboardSearchParams } from "./types";

type Props = {
  params: DashboardSearchParams;
  pending?: boolean;
  onRemove: (chip: ActiveFilterChip) => void;
  className?: string;
};

function formatCategoryLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

export default function ReportsActiveFilterChips({
  params,
  pending = false,
  onRemove,
  className,
}: Props) {
  const t = useTranslations("dashboard");
  const tt = useTranslations("dashboard.triage");
  const tr = useTranslations("dashboard.routing");
  const tAnalytics = useTranslations("dashboard.analytics");
  const locale = useLocale();

  const chips = useMemo(() => listActiveFilterChips(params), [params]);

  const labels = useMemo(() => {
    return chips.map((chip) => {
      switch (chip.type) {
        case "triage":
          return tt(
            chip.chipKey === "pending"
              ? "filterPending"
              : chip.chipKey === "needsReview"
                ? "filterNeedsReview"
                : "filterComplete",
          );
        case "routing":
          return tr(
            chip.chipKey === "government"
              ? "filterGovernmentDefault"
              : "filterSelfHelp",
          );
        case "severity":
          return t("activeFilterSeverity", {
            range: t(
              chip.chipKey === "low"
                ? "filterSeverityLow"
                : chip.chipKey === "midPlus"
                  ? "filterSeverityMidPlus"
                  : chip.chipKey === "highPlus"
                    ? "filterSeverityHighPlus"
                    : chip.chipKey === "critical"
                      ? "filterSeverityCritical"
                      : "filterSeverityAny",
            ),
          });
        case "status":
          return t(`status_${chip.value}` as "status_new");
        case "category":
          return formatCategoryLabel(chip.value);
        case "priority":
          return formatCategoryLabel(chip.value);
        case "shadow":
          return t("filterShadowDisagreement");
        case "date":
          if (chip.preset === "7") return tAnalytics("preset7");
          if (chip.preset === "30") return tAnalytics("preset30");
          if (chip.preset === "90") return tAnalytics("preset90");
          if (chip.after && chip.before) {
            return t("activeFilterDateRange", {
              from: formatDisplayDate(chip.after, locale),
              to: formatDisplayDate(chip.before, locale),
            });
          }
          if (chip.after) {
            return t("activeFilterDateFrom", {
              from: formatDisplayDate(chip.after, locale),
            });
          }
          return t("activeFilterDateTo", {
            to: formatDisplayDate(chip.before ?? "", locale),
          });
        default:
          return "";
      }
    });
  }, [chips, locale, t, tAnalytics, tr, tt]);

  if (chips.length === 0) return null;

  return (
    <div
      className={cn("reports-active-filter-chips", className)}
      aria-label={t("activeFiltersLabel")}
    >
      <ul className="flex min-w-0 flex-wrap items-center gap-1.5">
        {chips.map((chip, index) => {
          const label = labels[index];
          return (
            <li key={chip.id}>
              <span className="reports-active-filter-chip inline-flex max-w-full items-center gap-1 rounded-lg border border-border bg-background py-1 pl-2.5 pr-1 text-xs font-medium text-foreground">
                <span className="truncate">{label}</span>
                <button
                  type="button"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => onRemove(chip)}
                  disabled={pending}
                  aria-label={t("removeFilterAria", { filter: label })}
                >
                  <X className="size-3.5" strokeWidth={2.25} aria-hidden />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { clearActiveFilterChip };
