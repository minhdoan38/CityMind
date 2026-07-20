/**
 * Allow only same-origin path redirects (D-15 / T-02-09).
 * Rejects protocol-relative URLs (//evil), schemes, and non-path values.
 */
export function safeReturnUrl(
  candidate: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!candidate) return fallback;
  const value = candidate.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || value.includes("://")) return fallback;
  return value;
}
