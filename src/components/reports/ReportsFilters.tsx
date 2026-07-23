"use client";

import { type ReactNode, useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  SEVERITY_FILTER_CHIPS,
  applySeverityPreset,
  resolveSeverityPresetKey,
  type SeverityFilterChipKey,
} from "@/lib/severity-filter-presets";
import { cn } from "@/lib/utils";

import { ReportsPeriodPresets } from "@/components/reports/ReportsDateRangeFilter";
import ReportsActiveFilterChips, {
  clearActiveFilterChip,
} from "@/components/reports/ReportsActiveFilterChips";
import type { ActiveFilterChip } from "@/lib/active-filter-chips";
import {
  FILTER_PARAM_KEYS,
  countActiveFilters,
  type DashboardSearchParams,
} from "./types";

const STATUSES = ["new", "reviewing", "resolved", "rejected"] as const;
const CATEGORIES = [
  "pothole",
  "flooding",
  "waste",
  "streetlight",
  "obstruction",
  "other",
] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

const SEVERITY_CHIP_LABEL_KEYS: Record<
  SeverityFilterChipKey,
  "filterSeverityAny" | "filterSeverityLow" | "filterSeverityMidPlus" | "filterSeverityHighPlus" | "filterSeverityCritical"
> = {
  any: "filterSeverityAny",
  low: "filterSeverityLow",
  midPlus: "filterSeverityMidPlus",
  highPlus: "filterSeverityHighPlus",
  critical: "filterSeverityCritical",
};

const TRIAGE_FILTER_CHIPS = [
  { key: "all", param: null },
  { key: "pending", param: "pending,processing" },
  { key: "needsReview", param: "manual_review,failed" },
  { key: "complete", param: "completed" },
] as const;

const ROUTING_FILTER_CHIPS = [
  { key: "government", param: "government_default" },
  { key: "selfHelp", param: "self_help" },
  { key: "all", param: null },
] as const;

const SHADOW_FILTER_CHIPS = [
  { key: "all", param: null },
  { key: "disagreement", param: "true" },
] as const;

type Props = {
  params: DashboardSearchParams;
  layout?: "card" | "toolbar";
};

function valueOrAll(value: string | undefined): string {
  return value?.trim() ? value : "all";
}

export default function ReportsFilters({ params, layout = "card" }: Props) {
  const isToolbar = layout === "toolbar";
  const toggleSize = isToolbar ? "sm" : "default";
  const t = useTranslations("dashboard");
  const tt = useTranslations("dashboard.triage");
  const tr = useTranslations("dashboard.routing");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const activeFilterCount = useMemo(() => countActiveFilters(params), [params]);
  const filtersActive = activeFilterCount > 0;

  const defaultOpen = useMemo(
    () => activeFilterCount > 0,
    [activeFilterCount],
  );

  const drawerFilterCount = activeFilterCount;

  function navigate(next: URLSearchParams) {
    next.delete("cursor");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

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

  function setFilter(key: string, value: string) {
    const next = currentParams();
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    navigate(next);
  }

  function clearFilters() {
    const next = new URLSearchParams();
    if (params.limit) next.set("limit", params.limit);
    if (params.sort) next.set("sort", params.sort);
    if (params.order) next.set("order", params.order);
    navigate(next);
  }

  function setTriageChip(param: string | null) {
    const next = currentParams();
    if (!param) {
      next.delete("triage_status");
    } else {
      next.set("triage_status", param);
    }
    navigate(next);
  }

  function setRoutingChip(param: string | null) {
    const next = currentParams();
    if (!param) {
      next.delete("routing_destination");
    } else {
      next.set("routing_destination", param);
    }
    navigate(next);
  }

  function setShadowChip(param: string | null) {
    const next = currentParams();
    if (!param) {
      next.delete("shadow_disagreement");
    } else {
      next.set("shadow_disagreement", param);
    }
    navigate(next);
  }

  function setSeverityChip(key: SeverityFilterChipKey) {
    const next = currentParams();
    applySeverityPreset(next, key);
    navigate(next);
  }

  function removeActiveFilter(chip: ActiveFilterChip) {
    const next = currentParams();
    clearActiveFilterChip(next, chip);
    navigate(next);
  }

  const activeTriageParam = params.triage_status?.trim() || null;
  const activeRoutingParam = params.routing_destination?.trim() || null;
  const activeShadowParam = params.shadow_disagreement?.trim() || null;

  const activeTriageKey =
    TRIAGE_FILTER_CHIPS.find((chip) =>
      chip.param === null
        ? !activeTriageParam
        : activeTriageParam === chip.param,
    )?.key ?? "all";

  const activeRoutingKey =
    ROUTING_FILTER_CHIPS.find((chip) =>
      chip.param === null
        ? !activeRoutingParam || activeRoutingParam === "all"
        : activeRoutingParam === chip.param,
    )?.key ?? "all";

  const activeShadowKey =
    SHADOW_FILTER_CHIPS.find((chip) =>
      chip.param === null
        ? !activeShadowParam
        : activeShadowParam === chip.param,
    )?.key ?? "all";

  const activeSeverityKey =
    resolveSeverityPresetKey(params.min_severity, params.max_severity) ?? "";

  function renderRoutingChips(compact = false) {
    return (
      <FilterGroup
        label={t("filterGroupRouting")}
        inline={isToolbar && !compact}
        compact={compact}
      >
        <ToggleGroup
          type="single"
          variant="segmented"
          size={toggleSize}
          value={activeRoutingKey}
          disabled={pending}
          onValueChange={(value) => {
            if (!value) return;
            const chip = ROUTING_FILTER_CHIPS.find((item) => item.key === value);
            if (chip) setRoutingChip(chip.param);
          }}
          aria-label={t("filterGroupRouting")}
        >
          {ROUTING_FILTER_CHIPS.map((chip) => {
            const labelKey =
              chip.key === "government"
                ? "filterGovernmentDefault"
                : chip.key === "selfHelp"
                  ? "filterSelfHelp"
                  : "filterIncludeSelfHelp";
            return (
              <ToggleGroupItem key={chip.key} value={chip.key}>
                {tr(labelKey)}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </FilterGroup>
    );
  }

  function renderSavedViewToolbar() {
    return (
      <nav
        className="reports-saved-views min-w-0 flex-1"
        aria-label={t("savedViewsLabel")}
      >
        <ul className="flex min-w-0 flex-wrap items-center gap-1">
          {TRIAGE_FILTER_CHIPS.map((chip) => {
            const labelKey =
              chip.key === "all"
                ? "filterAll"
                : chip.key === "pending"
                  ? "filterToolbarPending"
                  : chip.key === "needsReview"
                    ? "filterToolbarNeedsReview"
                    : "filterToolbarComplete";
            const selected = activeTriageKey === chip.key;
            return (
              <li key={`triage-${chip.key}`}>
                <SavedViewChip
                  selected={selected}
                  disabled={pending}
                  onClick={() => setTriageChip(chip.param)}
                >
                  {tt(labelKey)}
                </SavedViewChip>
              </li>
            );
          })}
          <li
            aria-hidden
            className="reports-saved-view-divider mx-0.5 hidden h-4 w-px shrink-0 bg-border sm:block"
          />
          {ROUTING_FILTER_CHIPS.map((chip) => {
            const labelKey =
              chip.key === "government"
                ? "filterToolbarGovernment"
                : chip.key === "selfHelp"
                  ? "filterToolbarSelfHelp"
                  : "filterToolbarAll";
            const selected = activeRoutingKey === chip.key;
            return (
              <li key={`routing-${chip.key}`}>
                <SavedViewChip
                  selected={selected}
                  disabled={pending}
                  onClick={() => setRoutingChip(chip.param)}
                >
                  {tr(labelKey)}
                </SavedViewChip>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <section
      aria-busy={pending}
      className={cn(
        isToolbar
          ? "reports-filter-toolbar border-b border-dashed border-border bg-muted/15"
          : "surface-card dash-rise overflow-hidden",
        "transition-opacity duration-200",
        pending && "opacity-75",
      )}
    >
      <div className={isToolbar ? "px-4 py-2.5" : "p-4 sm:p-5"}>
        <Collapsible defaultOpen={defaultOpen}>
          <div
            className={cn(
              isToolbar
                ? "flex items-center justify-between gap-3"
                : "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
            )}
          >
            {isToolbar ? (
              renderSavedViewToolbar()
            ) : (
              <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5 sm:gap-y-3">
                <FilterGroup label={t("filterGroupTriage")}>
                  <ToggleGroup
                    type="single"
                    variant="segmented"
                    size={toggleSize}
                    value={activeTriageKey}
                    disabled={pending}
                    onValueChange={(value) => {
                      if (!value) return;
                      const chip = TRIAGE_FILTER_CHIPS.find(
                        (item) => item.key === value,
                      );
                      if (chip) setTriageChip(chip.param);
                    }}
                    aria-label={t("filterGroupTriage")}
                  >
                    {TRIAGE_FILTER_CHIPS.map((chip) => {
                      const labelKey =
                        chip.key === "all"
                          ? "filterAll"
                          : chip.key === "pending"
                            ? "filterPending"
                            : chip.key === "needsReview"
                              ? "filterNeedsReview"
                              : "filterComplete";
                      return (
                        <ToggleGroupItem key={chip.key} value={chip.key}>
                          {tt(labelKey)}
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                </FilterGroup>
              </div>
            )}

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size={isToolbar ? "sm" : "default"}
                  className={cn(
                    "group gap-2 font-semibold",
                    isToolbar
                      ? "border-border px-3"
                      : "border-border px-4",
                    "transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out-expo)]",
                    "hover:border-primary/35 hover:bg-muted/60 active:scale-[0.98]",
                    "data-[state=open]:border-primary/40 data-[state=open]:bg-primary/5",
                  )}
                  aria-label={t("filtersToggle")}
                >
                  <SlidersHorizontal
                    className="size-4 shrink-0 text-muted-foreground transition-colors group-data-[state=open]:text-primary"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <span className={isToolbar ? "text-xs" : undefined}>
                    {t("filtersToggle")}
                  </span>
                  {drawerFilterCount > 0 ? (
                    <Badge
                      variant="secondary"
                      className="h-5 min-w-5 justify-center rounded-full bg-primary/15 px-1.5 text-[0.6875rem] font-bold text-primary"
                    >
                      {drawerFilterCount}
                    </Badge>
                  ) : null}
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[var(--ease-out-expo)] group-data-[state=open]:rotate-180 group-data-[state=open]:text-primary"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {filtersActive ? (
            <ReportsActiveFilterChips
              params={params}
              pending={pending}
              onRemove={removeActiveFilter}
              className={cn(isToolbar ? "mt-2.5" : "mt-3")}
            />
          ) : null}

          <CollapsibleContent
            className={cn(
              "grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-out-expo)]",
              "data-[state=closed]:grid-rows-[0fr] data-[state=closed]:opacity-0",
              "data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100",
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div
                className={cn(
                  "reports-filter-advanced-grid grid border-t border-border sm:grid-cols-2 lg:grid-cols-3",
                  isToolbar ? "gap-5 pt-5" : "gap-4 pt-4",
                )}
              >
                <ReportsPeriodPresets params={params} compact={isToolbar} />
                {!isToolbar ? renderRoutingChips(true) : null}
                <FilterGroup label={t("filterGroupSeverity")} compact={isToolbar}>
                  <ToggleGroup
                    type="single"
                    variant="segmented"
                    size={toggleSize}
                    value={activeSeverityKey}
                    disabled={pending}
                    onValueChange={(value) => {
                      if (!value) return;
                      setSeverityChip(value as SeverityFilterChipKey);
                    }}
                    aria-label={t("filterGroupSeverity")}
                  >
                    {SEVERITY_FILTER_CHIPS.map((chip) => (
                      <ToggleGroupItem key={chip.key} value={chip.key}>
                        {t(SEVERITY_CHIP_LABEL_KEYS[chip.key])}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </FilterGroup>
                <FilterSelect
                  id="filter-status"
                  label={t("filterStatus")}
                  value={valueOrAll(params.status)}
                  onChange={(v) => setFilter("status", v)}
                  options={STATUSES.map((s) => ({
                    value: s,
                    label: t(`status_${s}` as "status_new"),
                  }))}
                  allLabel={t("filterAllStatuses")}
                  compact={isToolbar}
                />
                <FilterSelect
                  id="filter-category"
                  label={t("filterCategory")}
                  value={valueOrAll(params.category)}
                  onChange={(v) => setFilter("category", v)}
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  allLabel={t("filterAllCategories")}
                  compact={isToolbar}
                />
                <FilterSelect
                  id="filter-priority"
                  label={t("filterPriority")}
                  value={valueOrAll(params.priority)}
                  onChange={(v) => setFilter("priority", v)}
                  options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                  allLabel={t("filterAllPriorities")}
                  compact={isToolbar}
                />
                <FilterGroup label={t("filterGroupShadow")} compact={isToolbar}>
                  <ToggleGroup
                    type="single"
                    variant="segmented"
                    size={toggleSize}
                    value={activeShadowKey}
                    disabled={pending}
                    onValueChange={(value) => {
                      if (!value) return;
                      const chip = SHADOW_FILTER_CHIPS.find(
                        (item) => item.key === value,
                      );
                      if (chip) setShadowChip(chip.param);
                    }}
                    aria-label={t("filterGroupShadow")}
                  >
                    {SHADOW_FILTER_CHIPS.map((chip) => {
                      const label =
                        chip.key === "all"
                          ? t("filterShadowAll")
                          : t("filterShadowDisagreement");
                      return (
                        <ToggleGroupItem key={chip.key} value={chip.key}>
                          {label}
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                </FilterGroup>
              </div>
              <div
                className={cn(
                  "flex border-t border-border",
                  isToolbar ? "mt-5 pt-4" : "mt-4 pt-4",
                )}
              >
                <Button
                  type="button"
                  variant="outline"
                  size={isToolbar ? "sm" : "default"}
                  className={cn(
                    "w-full font-semibold transition-colors duration-150",
                    filtersActive
                      ? "text-foreground hover:text-foreground"
                      : "border-transparent bg-transparent text-muted-foreground/45 shadow-none hover:bg-transparent hover:text-muted-foreground/45",
                  )}
                  onClick={clearFilters}
                  disabled={pending || !filtersActive}
                  aria-disabled={pending || !filtersActive}
                >
                  {filtersActive
                    ? t("clearFiltersWithCount", { count: activeFilterCount })
                    : t("clearFilters")}
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </section>
  );
}

function SavedViewChip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "reports-saved-view-chip inline-flex max-w-full items-center border px-3 py-1.5 text-xs font-medium transition-[background-color,border-color,color,box-shadow] duration-150 ease-[var(--ease-out-expo)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "dash-selected"
          : "border-border bg-background text-muted-foreground hover:border-primary/25 hover:bg-muted/50 hover:text-foreground",
      )}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="truncate">{children}</span>
    </button>
  );
}

function FilterGroup({
  label,
  children,
  inline = false,
  compact = false,
  className,
}: {
  label: string;
  children: ReactNode;
  inline?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (inline) {
    return (
      <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
        <span className="reports-filter-group-label shrink-0">{label}</span>
        <div className="min-w-0 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "reports-filter-field min-w-0",
        compact ? "gap-1.5" : "space-y-2",
        className,
      )}
    >
      <p
        className={cn(
          compact
            ? "text-xs font-medium text-muted-foreground"
            : "text-sm font-semibold text-foreground",
        )}
      >
        {label}
      </p>
      <div className="overflow-x-auto pb-0.5">{children}</div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
  compact = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("reports-filter-field", compact ? "gap-1.5" : "space-y-2")}>
      <Label
        htmlFor={id}
        className={cn(
          compact
            ? "text-xs font-medium text-muted-foreground"
            : "text-sm font-semibold text-foreground",
        )}
      >
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className={cn(
            "reports-filter-select-trigger w-full font-medium transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-expo)] focus-visible:ring-primary/30",
            compact
              ? "h-10 min-h-10 rounded-[var(--radius-control)] border-border text-sm"
              : "h-10 min-h-10 rounded-[var(--radius-control)] border-border",
          )}
        >
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
