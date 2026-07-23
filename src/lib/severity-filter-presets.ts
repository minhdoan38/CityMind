export const SEVERITY_FILTER_CHIPS = [
  { key: "any", min: null, max: null },
  { key: "low", min: 1, max: 2 },
  { key: "midPlus", min: 3, max: null },
  { key: "highPlus", min: 4, max: null },
  { key: "critical", min: 5, max: 5 },
] as const;

export type SeverityFilterChipKey =
  (typeof SEVERITY_FILTER_CHIPS)[number]["key"];

function parseSeverityParam(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return null;
  return parsed;
}

/** Maps URL min/max severity params to a preset chip key, or null for custom combos. */
export function resolveSeverityPresetKey(
  min?: string,
  max?: string,
): SeverityFilterChipKey | null {
  const minN = parseSeverityParam(min);
  const maxN = parseSeverityParam(max);

  if (minN == null && maxN == null) return "any";

  for (const chip of SEVERITY_FILTER_CHIPS) {
    if (chip.key === "any") continue;
    if (chip.min === minN && chip.max === maxN) return chip.key;
  }

  return null;
}

export function applySeverityPreset(
  params: URLSearchParams,
  key: SeverityFilterChipKey,
): void {
  const chip = SEVERITY_FILTER_CHIPS.find((item) => item.key === key);
  if (!chip) return;

  params.delete("min_severity");
  params.delete("max_severity");

  if (chip.key === "any") return;

  if (chip.min != null) {
    params.set("min_severity", String(chip.min));
  }
  if (chip.max != null) {
    params.set("max_severity", String(chip.max));
  }
}

export function severityFilterActive(
  min?: string,
  max?: string,
): boolean {
  return Boolean(min?.trim() || max?.trim());
}
