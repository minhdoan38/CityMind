export const PLAYBOOK_BY_CATEGORY: Record<string, string> = {
  pothole: "pothole",
  waste: "waste",
  streetlight: "streetlight",
  graffiti: "graffiti",
};

export function resolvePlaybookId(category: string | null): string | null {
  if (!category) return null;
  return PLAYBOOK_BY_CATEGORY[category] ?? null;
}
