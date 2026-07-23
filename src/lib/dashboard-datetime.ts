const EN_LOCALE = "en-US";
const VI_LOCALE = "vi-VN";

export function resolveDashboardDateLocale(locale: string): string {
  return locale === "vi" ? VI_LOCALE : EN_LOCALE;
}

export function formatDashboardWhenCompact(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(resolveDashboardDateLocale(locale), {
    month: "short",
    day: "numeric",
  });
}

export function formatDashboardWhenFull(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(resolveDashboardDateLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: locale !== "vi",
  });
}
