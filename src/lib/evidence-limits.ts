export const DEFAULT_MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export function resolveMaxEvidenceBytesFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw =
    env.MAX_IMAGE_BYTES?.trim() ?? env.NEXT_PUBLIC_MAX_IMAGE_BYTES?.trim();
  if (!raw) return DEFAULT_MAX_EVIDENCE_BYTES;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_EVIDENCE_BYTES;
  }
  return parsed;
}
