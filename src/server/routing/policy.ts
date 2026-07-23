export const ROUTING_POLICY_VERSION = "1.1.0";

export const CONFIDENCE_GOV_THRESHOLD = 0.65;

const SELF_HELP_CATEGORIES = new Set(["graffiti", "waste", "pothole", "streetlight"]);
const GOVERNMENT_PRIORITIES = new Set(["high", "critical"]);

export type RoutingDestination = "self_help" | "government";

export type GuidanceStatus = "script_ready" | "generate_later";

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
  handling_type?: 1 | 2 | 3 | null;
  guidance_status?: GuidanceStatus | null;
  critical_alert?: boolean | null;
}): RoutingDecision {
  const base: Pick<RoutingDecision, "policyVersion"> = {
    policyVersion: ROUTING_POLICY_VERSION,
  };

  if (input.triageStatus === "manual_review" || input.triageStatus === "failed") {
    return { ...base, destination: "government", reasonCode: "triage_manual_or_failed" };
  }

  if (input.handling_type != null) {
    if (input.critical_alert) {
      return { ...base, destination: "government", reasonCode: "critical_alert" };
    }

    if (input.handling_type === 2 || input.handling_type === 3) {
      return { ...base, destination: "government", reasonCode: "handling_type_government" };
    }

    if (input.guidance_status === "generate_later") {
      return { ...base, destination: "government", reasonCode: "guidance_pending" };
    }

    if (input.handling_type === 1 && input.guidance_status === "script_ready") {
      return { ...base, destination: "self_help", reasonCode: "hanoi_self_guidance" };
    }
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
