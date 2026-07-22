export const PROMPT_VERSION = "phase8-mvp-v1";
export const MAX_INFRA_ATTEMPTS = 3;

export const INFRA_BACKOFF_MS = [30_000, 120_000, 600_000] as const;

export function infraBackoffMs(attemptIndex: number): number {
  const index = Math.min(Math.max(attemptIndex, 0), INFRA_BACKOFF_MS.length - 1);
  return INFRA_BACKOFF_MS[index] ?? INFRA_BACKOFF_MS[INFRA_BACKOFF_MS.length - 1]!;
}
