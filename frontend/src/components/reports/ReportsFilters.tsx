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

type Props = {
  params: DashboardSearchParams;
};

function valueOrAll(value: string | undefined): string {
  return value?.trim() ? value : "all";
}

export default function ReportsFilters({ params }: Props) {
  const t = useTranslations("dashboard");
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

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="rounded-lg border border-border bg-secondary/40"
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
