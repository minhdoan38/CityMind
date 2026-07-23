import { readFileSync } from "node:fs";
import path from "node:path";

import type { EvaluatorAnalysis } from "../domain/evaluator-analysis";

export type PolicyViolation = {
  code: string;
  message: string;
};

export type PolicyResult =
  | { ok: true }
  | { ok: false; violations: PolicyViolation[] };

type EvaluatorPolicyConfig = {
  policy_evaluator: {
    occurred_injury_claim_check: {
      occurred_claim_examples: string[];
    };
    unsupported_cause_check: {
      trigger_phrases: string[];
    };
    unsupported_occurred_event_check: {
      events: string[];
    };
    hidden_property_check: {
      properties: string[];
    };
    action_claim_check: {
      forbidden_without_evidence: string[];
    };
    conflict_confidence_check: {
      when_sources_conflict: {
        maximum_confidence: number;
      };
    };
  };
};

const LOW_CONFIDENCE_THRESHOLD = 0.3;

const IMMEDIATE_DANGER_PATTERNS = [
  /\bimmediate danger\b/i,
  /\bimminent\b/i,
  /\bactive fire\b/i,
  /\blive electrical\b/i,
  /\bentrapment\b/i,
  /\bcollision risk\b/i,
  /\bactive flooding\b/i,
  /\bcollapse\b/i,
  /\blife[- ]safety\b/i,
];

const HAZARD_PATTERNS = [
  /\bhazard\b/i,
  /\bdanger\b/i,
  /\bunsafe\b/i,
  /\brisk\b/i,
  /\bexposed\b/i,
];

const AUTONOMOUS_AUTHORITY_PATTERNS = [
  /\bfinal decision\b/i,
  /\bautonomous(?:ly)?\b/i,
  /\bwithout officer\b/i,
  /\bno human review\b/i,
];

let cachedPolicyConfig: EvaluatorPolicyConfig | null = null;

function loadPolicyConfig(): EvaluatorPolicyConfig {
  if (cachedPolicyConfig) {
    return cachedPolicyConfig;
  }
  const configPath = path.resolve(
    process.cwd(),
    "prompt/citymind_ai_triage_structured_output_evaluator.json",
  );
  cachedPolicyConfig = JSON.parse(readFileSync(configPath, "utf8")) as EvaluatorPolicyConfig;
  return cachedPolicyConfig;
}

function violation(code: string, message: string): PolicyViolation {
  return { code, message };
}

function containsPhrase(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function fieldText(analysis: EvaluatorAnalysis): string {
  return [
    ...analysis.observed_facts,
    ...analysis.inferences,
    analysis.severity_reason,
    analysis.priority_reason,
    analysis.recommended_action,
  ].join(" ");
}

function hasImmediateDangerEvidence(observedFacts: string[]): boolean {
  return observedFacts.some((item) =>
    IMMEDIATE_DANGER_PATTERNS.some((pattern) => pattern.test(item)),
  );
}

function hasSupportedHazardEvidence(observedFacts: string[]): boolean {
  return observedFacts.some((item) =>
    HAZARD_PATTERNS.some((pattern) => pattern.test(item)),
  );
}

function hasConflictingSignals(analysis: EvaluatorAnalysis): boolean {
  const conflictInUnknowns = analysis.unknowns.some((item) =>
    /\bconflict\b|\bcontradict\b|\bunclear\b|\bambiguous\b|\bdisagree\b/i.test(item),
  );
  const cap = loadPolicyConfig().policy_evaluator.conflict_confidence_check
    .when_sources_conflict.maximum_confidence;
  return conflictInUnknowns || (analysis.unknowns.length > 0 && analysis.confidence <= cap);
}

function reasonGroundedInObservedFacts(
  reason: string,
  observedFacts: string[],
): boolean {
  const normalizedReason = reason.trim().toLowerCase();
  if (!normalizedReason) {
    return false;
  }
  const observedText = observedFacts.join(" ").toLowerCase();
  const words = normalizedReason.split(/\s+/).filter((word) => word.length > 4);
  if (words.length === 0) {
    return observedFacts.some((fact) => normalizedReason.includes(fact.trim().toLowerCase()));
  }
  return words.some((word) => observedText.includes(word));
}

function hasUnsupportedObservedFactClaim(
  description: string,
  observedFacts: string[],
): boolean {
  const normalizedDescription = description.trim().toLowerCase();
  if (!normalizedDescription) {
    return observedFacts.some((item) => item.trim().length > 0);
  }
  return observedFacts.some((item) => {
    const normalized = item.trim().toLowerCase();
    if (!normalized) return false;
    const words = normalized.split(/\s+/).filter((word) => word.length > 4);
    if (words.length === 0) return false;
    return !words.some((word) => normalizedDescription.includes(word));
  });
}

export function validateEvaluatorPolicy(
  analysis: EvaluatorAnalysis,
  options: { description?: string } = {},
): PolicyResult {
  const violations: PolicyViolation[] = [];
  const config = loadPolicyConfig();

  for (const item of analysis.observed_facts) {
    if (!item.trim()) {
      violations.push(violation("empty_observed_fact", "Observed facts must be non-empty."));
    }
  }

  for (const item of analysis.inferences) {
    if (!item.trim()) {
      violations.push(violation("empty_inference", "Inferences must be non-empty."));
    }
  }

  for (const item of analysis.unknowns) {
    if (!item.trim()) {
      violations.push(violation("empty_unknown", "Unknowns must be non-empty."));
    }
  }

  if (analysis.requires_human_review !== true) {
    violations.push(
      violation("requires_human_review_false", "requires_human_review must be true."),
    );
  }

  if (analysis.confidence < LOW_CONFIDENCE_THRESHOLD && analysis.unknowns.length === 0) {
    violations.push(
      violation(
        "low_confidence_missing_unknowns",
        "Low-confidence analyses must document unknowns.",
      ),
    );
  }

  if (analysis.priority === "critical" && analysis.severity !== 5) {
    violations.push(
      violation(
        "critical_requires_severity_5",
        "Critical priority requires severity 5 alignment.",
      ),
    );
  }

  if (analysis.severity === 5 && !hasImmediateDangerEvidence(analysis.observed_facts)) {
    violations.push(
      violation(
        "severity_5_requires_danger_evidence",
        "Severity 5 requires immediate-danger evidence in observed_facts.",
      ),
    );
  }

  if (analysis.severity === 4 && !hasSupportedHazardEvidence(analysis.observed_facts)) {
    violations.push(
      violation(
        "severity_4_requires_supported_hazard",
        "Severity 4 requires a directly supported credible safety hazard in observed_facts.",
      ),
    );
  }

  if (
    !reasonGroundedInObservedFacts(analysis.severity_reason, analysis.observed_facts)
  ) {
    violations.push(
      violation(
        "severity_reason_not_grounded",
        "severity_reason must be traceable to observed_facts.",
      ),
    );
  }

  if (
    !reasonGroundedInObservedFacts(analysis.priority_reason, analysis.observed_facts)
  ) {
    violations.push(
      violation(
        "priority_reason_not_grounded",
        "priority_reason must be traceable to observed_facts.",
      ),
    );
  }

  const conflictCap =
    config.policy_evaluator.conflict_confidence_check.when_sources_conflict
      .maximum_confidence;
  if (hasConflictingSignals(analysis) && analysis.confidence > conflictCap) {
    violations.push(
      violation(
        "conflict_confidence_cap",
        "Conflicting signals require confidence at or below 0.64.",
      ),
    );
  }

  if (
    options.description !== undefined &&
    hasUnsupportedObservedFactClaim(options.description, analysis.observed_facts)
  ) {
    violations.push(
      violation(
        "unsupported_observed_fact_claim",
        "observed_facts must be grounded in the citizen description.",
      ),
    );
  }

  const combinedText = fieldText(analysis);
  for (const phrase of config.policy_evaluator.occurred_injury_claim_check
    .occurred_claim_examples) {
    if (containsPhrase(combinedText, phrase)) {
      violations.push(
        violation(
          "unsupported_occurred_injury_claim",
          "Output must not assert injury already occurred without explicit evidence.",
        ),
      );
      break;
    }
  }

  for (const phrase of config.policy_evaluator.unsupported_cause_check.trigger_phrases) {
    if (containsPhrase(combinedText, phrase)) {
      violations.push(
        violation(
          "unsupported_cause_claim",
          "Output must not assert unsupported causal relations.",
        ),
      );
      break;
    }
  }

  for (const event of config.policy_evaluator.unsupported_occurred_event_check.events) {
    if (containsPhrase(combinedText, event)) {
      const grounded = analysis.observed_facts.some((fact) =>
        containsPhrase(fact, event),
      );
      if (!grounded) {
        violations.push(
          violation(
            "unsupported_occurred_event_claim",
            "Occurred-event claims must be explicitly supported in observed_facts.",
          ),
        );
        break;
      }
    }
  }

  for (const phrase of config.policy_evaluator.action_claim_check.forbidden_without_evidence) {
    if (containsPhrase(analysis.recommended_action, phrase)) {
      violations.push(
        violation(
          "forbidden_action_claim",
          "recommended_action must not claim completed dispatch or resolution.",
        ),
      );
      break;
    }
  }

  const advisoryText = `${analysis.severity_reason} ${analysis.recommended_action}`;
  if (AUTONOMOUS_AUTHORITY_PATTERNS.some((pattern) => pattern.test(advisoryText))) {
    violations.push(
      violation(
        "autonomous_authority_language",
        "Advisory output must not claim autonomous final authority.",
      ),
    );
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }

  return { ok: true };
}
