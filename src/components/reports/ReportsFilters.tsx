"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  FILTER_PARAM_KEYS,
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
const SEVERITIES = ["1", "2", "3", "4", "5"] as const;

const TRIAGE_FILTER_CHIPS = [
  { key: "all", param: null },
  { key: "pending", param: "pending,processing" },
  { key: "needsReview", param: "manual_review,failed" },
  { key: "complete", param: "completed" },
] as const;

const ROUTING_FILTER_CHIPS = [
  { key: "government", param: null },
  { key: "selfHelp", param: "self_help" },
  { key: "all", param: "all" },
] as const;

const SHADOW_FILTER_CHIPS = [
  { key: "all", param: null },
  { key: "disagreement", param: "true" },
] as const;

type Props = {
  params: DashboardSearchParams;
};

function valueOrAll(value: string | undefined): string {
  return value?.trim() ? value : "all";
}

export default function ReportsFilters({ params }: Props) {
  const t = useTranslations("dashboard");
  const tt = useTranslations("dashboard.triage");
  const tr = useTranslations("dashboard.routing");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const defaultOpen = useMemo(
    () => FILTER_PARAM_KEYS.some((key) => Boolean(params[key]?.trim())),
    [params],
  );

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

  const activeTriageParam = params.triage_status?.trim() || null;
  const activeRoutingParam = params.routing_destination?.trim() || null;
  const activeShadowParam = params.shadow_disagreement?.trim() || null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TRIAGE_FILTER_CHIPS.map((chip) => {
          const active =
            chip.param === null
              ? !activeTriageParam
              : activeTriageParam === chip.param;
          const labelKey =
            chip.key === "all"
              ? "filterAll"
              : chip.key === "pending"
                ? "filterPending"
                : chip.key === "needsReview"
                  ? "filterNeedsReview"
                  : "filterComplete";
          return (
            <Button
              key={chip.key}
              type="button"
              variant={active ? "default" : "outline"}
              className="min-h-11"
              aria-pressed={active}
              disabled={pending}
              onClick={() => setTriageChip(chip.param)}
            >
              {tt(labelKey)}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {ROUTING_FILTER_CHIPS.map((chip) => {
          const active =
            chip.param === null
              ? !activeRoutingParam || activeRoutingParam === "government_default"
              : activeRoutingParam === chip.param;
          const labelKey =
            chip.key === "government"
              ? "filterGovernmentDefault"
              : chip.key === "selfHelp"
                ? "filterSelfHelp"
                : "filterIncludeSelfHelp";
          return (
            <Button
              key={chip.key}
              type="button"
              variant={active ? "default" : "outline"}
              className="min-h-11"
              aria-pressed={active}
              disabled={pending}
              onClick={() => setRoutingChip(chip.param)}
            >
              {tr(labelKey)}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {SHADOW_FILTER_CHIPS.map((chip) => {
          const active =
            chip.param === null
              ? !activeShadowParam
              : activeShadowParam === chip.param;
          const label =
            chip.key === "all" ? "All shadow results" : "Shadow disagreement";
          return (
            <Button
              key={chip.key}
              type="button"
              variant={active ? "default" : "outline"}
              className="min-h-11"
              aria-pressed={active}
              disabled={pending}
              onClick={() => setShadowChip(chip.param)}
            >
              {label}
            </Button>
          );
        })}
      </div>

    <Collapsible
      defaultOpen={defaultOpen}
      className="surface-card overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2"
            aria-label={t("filtersToggle")}
          >
            {t("filtersToggle")}
            <ChevronDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={clearFilters}
          disabled={pending}
        >
          {t("clearFilters")}
        </Button>
      </div>

      <CollapsibleContent className="border-t border-border px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FilterSelect
            id="filter-status"
            label={t("filterStatus")}
            value={valueOrAll(params.status)}
            onChange={(v) => setFilter("status", v)}
            options={STATUSES.map((s) => ({ value: s, label: t(`status_${s}` as "status_new") }))}
            allLabel={t("filterAny")}
          />
          <FilterSelect
            id="filter-category"
            label={t("filterCategory")}
            value={valueOrAll(params.category)}
            onChange={(v) => setFilter("category", v)}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            allLabel={t("filterAny")}
          />
          <FilterSelect
            id="filter-priority"
            label={t("filterPriority")}
            value={valueOrAll(params.priority)}
            onChange={(v) => setFilter("priority", v)}
            options={PRIORITIES.map((p) => ({ value: p, label: p }))}
            allLabel={t("filterAny")}
          />
          <FilterSelect
            id="filter-min-severity"
            label={t("filterMinSeverity")}
            value={valueOrAll(params.min_severity)}
            onChange={(v) => setFilter("min_severity", v)}
            options={SEVERITIES.map((s) => ({ value: s, label: s }))}
            allLabel={t("filterAny")}
          />
          <FilterSelect
            id="filter-max-severity"
            label={t("filterMaxSeverity")}
            value={valueOrAll(params.max_severity)}
            onChange={(v) => setFilter("max_severity", v)}
            options={SEVERITIES.map((s) => ({ value: s, label: s }))}
            allLabel={t("filterAny")}
          />
          <div className="space-y-2">
            <Label htmlFor="filter-created-after" className="text-sm font-normal text-muted-foreground">
              {t("filterCreatedAfter")}
            </Label>
            <Input
              id="filter-created-after"
              type="date"
              className="min-h-11"
              value={params.created_after?.slice(0, 10) ?? ""}
              onChange={(e) =>
                setFilter(
                  "created_after",
                  e.target.value ? `${e.target.value}T00:00:00Z` : "",
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-created-before" className="text-sm font-normal text-muted-foreground">
              {t("filterCreatedBefore")}
            </Label>
            <Input
              id="filter-created-before"
              type="date"
              className="min-h-11"
              value={params.created_before?.slice(0, 10) ?? ""}
              onChange={(e) =>
                setFilter(
                  "created_before",
                  e.target.value ? `${e.target.value}T23:59:59Z` : "",
                )
              }
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="min-h-11 w-full">
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
