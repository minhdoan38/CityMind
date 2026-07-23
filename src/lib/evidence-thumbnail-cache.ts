const memory = new Map<string, string>();

export function getCachedThumbnailUrl(reportId: string): string | null {
  return memory.get(reportId) ?? null;
}

export function rememberThumbnailBlob(reportId: string, blob: Blob): string {
  const existing = memory.get(reportId);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  memory.set(reportId, url);
  return url;
}

export async function loadEvidenceThumbnail(
  reportId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const cached = getCachedThumbnailUrl(reportId);
  if (cached) return cached;

  const res = await fetch(`/api/officer/reports/${reportId}/image`, {
    credentials: "include",
    signal,
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return rememberThumbnailBlob(reportId, blob);
}
