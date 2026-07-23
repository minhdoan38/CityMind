import {
  resolveSeverityPresetKey,
  type SeverityFilterChipKey,
} from "@/lib/severity-filter-presets";
import type { DashboardSearchParams } from "@/components/reports/types";

const PRESET_DAYS = ["7", "30", "90"] as const;
type PresetDays = (typeof PRESET_DAYS)[number];

export type ActiveFilterChip =
  | { id: string; type: "triage"; chipKey: "pending" | "needsReview" | "complete" }
  | { id: string; type: "routing"; chipKey: "government" | "selfHelp" }
  | { id: string; type: "severity"; chipKey: SeverityFilterChipKey }
  | { id: string; type: "status"; value: string }
  | { id: string; type: "category"; value: string }
  | { id: string; type: "priority"; value: string }
  | { id: string; type: "shadow" }
  | {
      id: string;
      type: "date";
      preset: PresetDays | "custom";
      after?: string;
      before?: string;
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

function detectDatePreset(
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

/** Ordered list of active filter chips for the summary row. */
export function listActiveFilterChips(
  params: DashboardSearchParams,
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  const triage = params.triage_status?.trim();
  if (triage === "pending,processing") {
    chips.push({ id: "triage-pending", type: "triage", chipKey: "pending" });
  } else if (triage === "manual_review,failed") {
    chips.push({ id: "triage-needs-review", type: "triage", chipKey: "needsReview" });
  } else if (triage === "completed") {
    chips.push({ id: "triage-complete", type: "triage", chipKey: "complete" });
  } else if (triage) {
    chips.push({ id: "triage-custom", type: "triage", chipKey: "needsReview" });
  }

  const severityKey = resolveSeverityPresetKey(
    params.min_severity,
    params.max_severity,
  );
  if (
    severityKey &&
    severityKey !== "any" &&
    (params.min_severity?.trim() || params.max_severity?.trim())
  ) {
    chips.push({ id: `severity-${severityKey}`, type: "severity", chipKey: severityKey });
  } else if (
    !severityKey &&
    (params.min_severity?.trim() || params.max_severity?.trim())
  ) {
    chips.push({ id: "severity-custom", type: "severity", chipKey: "highPlus" });
  }

  if (params.status?.trim()) {
    chips.push({
      id: `status-${params.status}`,
      type: "status",
      value: params.status.trim(),
    });
  }

  if (params.category?.trim()) {
    chips.push({
      id: `category-${params.category}`,
      type: "category",
      value: params.category.trim(),
    });
  }

  if (params.priority?.trim()) {
    chips.push({
      id: `priority-${params.priority}`,
      type: "priority",
      value: params.priority.trim(),
    });
  }

  const routing = params.routing_destination?.trim();
  if (routing === "government_default") {
    chips.push({ id: "routing-government", type: "routing", chipKey: "government" });
  } else if (routing === "self_help") {
    chips.push({ id: "routing-self-help", type: "routing", chipKey: "selfHelp" });
  }

  const datePreset = detectDatePreset(params.created_after, params.created_before);
  if (datePreset) {
    chips.push({
      id: `date-${datePreset}`,
      type: "date",
      preset: datePreset,
      after: params.created_after,
      before: params.created_before,
    });
  }

  if (params.shadow_disagreement?.trim()) {
    chips.push({ id: "shadow-disagreement", type: "shadow" });
  }

  return chips;
}

export function clearActiveFilterChip(
  searchParams: URLSearchParams,
  chip: ActiveFilterChip,
): void {
  switch (chip.type) {
    case "triage":
      searchParams.delete("triage_status");
      break;
    case "routing":
      searchParams.delete("routing_destination");
      break;
    case "severity":
      searchParams.delete("min_severity");
      searchParams.delete("max_severity");
      break;
    case "status":
      searchParams.delete("status");
      break;
    case "category":
      searchParams.delete("category");
      break;
    case "priority":
      searchParams.delete("priority");
      break;
    case "shadow":
      searchParams.delete("shadow_disagreement");
      break;
    case "date":
      searchParams.delete("created_after");
      searchParams.delete("created_before");
      break;
    default:
      break;
  }
}
