export type TriageDisposition = "completed" | "manual_review" | "failed" | "retry";

export type DispositionInput = {
  infraAttempt: number;
  maxInfraAttempts: number;
  policyViolations: boolean;
  hadValidationRetry: boolean;
  unrecoverableError: boolean;
};

export function resolveDisposition(input: DispositionInput): TriageDisposition {
  if (input.unrecoverableError) {
    return "failed";
  }

  if (input.policyViolations) {
    return input.hadValidationRetry ? "manual_review" : "retry";
  }

  if (input.infraAttempt >= input.maxInfraAttempts) {
    return "manual_review";
  }

  return "completed";
}

export function resolveInfraFailureDisposition(
  infraAttempt: number,
  maxInfraAttempts: number,
): TriageDisposition {
  if (infraAttempt >= maxInfraAttempts) {
    return "manual_review";
  }
  return "retry";
}
