/**
 * Best-effort parse of triage agent raw JSON for officer console display.
 * Invalid or partial JSON returns null — raw output remains available separately.
 */

export type TriageOutputSummary = {
  category?: string;
  matched_known_issue?: boolean;
  observed_facts: string[];
  inferences: string[];
  output_language?: string;
};

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function parseTriageOutputSummary(raw: string): TriageOutputSummary | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const observed_facts = stringArray(parsed.observed_facts);
    const inferences = stringArray(parsed.inferences);
    const category = typeof parsed.category === "string" ? parsed.category : undefined;
    const matched_known_issue =
      typeof parsed.matched_known_issue === "boolean" ? parsed.matched_known_issue : undefined;
    const output_language =
      typeof parsed.output_language === "string" ? parsed.output_language : undefined;

    if (
      !category &&
      matched_known_issue === undefined &&
      observed_facts.length === 0 &&
      inferences.length === 0 &&
      !output_language
    ) {
      return null;
    }

    return {
      category,
      matched_known_issue,
      observed_facts,
      inferences,
      output_language,
    };
  } catch {
    return null;
  }
}

export function hasTriageOutputSummary(summary: TriageOutputSummary | null): boolean {
  if (!summary) return false;
  return Boolean(
    summary.category ||
      summary.matched_known_issue !== undefined ||
      summary.observed_facts.length > 0 ||
      summary.inferences.length > 0 ||
      summary.output_language,
  );
}
