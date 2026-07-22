export const ROUTING_POLICY_VERSION = "1.0.0";

export const CONFIDENCE_GOV_THRESHOLD = 0.65;

const SELF_HELP_CATEGORIES = new Set(["graffiti", "waste", "pothole", "streetlight"]);
const GOVERNMENT_PRIORITIES = new Set(["high", "critical"]);

export type RoutingDestination = "self_help" | "government";

export type RoutingDecision = {
  destination: RoutingDestination;
  reasonCode: string;
  policyVersion: typeof ROUTING_POLICY_VERSION;
};

export function evaluateRoutingPolicy(input: {
  triageStatus: string;
  category: string | null;
  severity: number | null;
  priority: string | null;
  confidence: number | null;
}): RoutingDecision {
  const base = { policyVersion: ROUTING_POLICY_VERSION };

  if (input.triageStatus === "manual_review" || input.triageStatus === "failed") {
    return { ...base, destination: "government", reasonCode: "triage_manual_or_failed" };
  }

  if ((input.severity ?? 0) >= 4 || GOVERNMENT_PRIORITIES.has(input.priority ?? "")) {
    return { ...base, destination: "government", reasonCode: "severity_or_priority" };
  }

  if ((input.confidence ?? 0) < CONFIDENCE_GOV_THRESHOLD) {
    return { ...base, destination: "government", reasonCode: "low_confidence" };
  }

  if (
    SELF_HELP_CATEGORIES.has(input.category ?? "") &&
    (input.severity ?? 99) <= 2
  ) {
    return { ...base, destination: "self_help", reasonCode: "eligible_category_low_severity" };
  }

  return { ...base, destination: "government", reasonCode: "default_government" };
}
