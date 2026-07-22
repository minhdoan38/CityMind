import { getTranslations } from "next-intl/server";

import { loadPublicStats } from "@/server/services/officer-analytics";

function formatCategoryLabel(category: string): string {
  if (!category || category === "unknown") {
    return category;
  }
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ");
}

export default async function PublicStatsStrip() {
  const t = await getTranslations("public.stats");
  const stats = await loadPublicStats();

  if (!stats) {
    return null;
  }

  return (
    <section
      aria-labelledby="community-snapshot-heading"
      className="w-full scroll-mt-24 border-y border-border bg-secondary px-6 py-12 md:py-16"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="max-w-2xl space-y-2">
          <h2
            id="community-snapshot-heading"
            className="text-balance text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-0.02em] text-foreground"
          >
            {t("sectionTitle")}
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {t("sectionBody")}
          </p>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
          <div className="rounded-2xl border border-border bg-white p-5">
            <dt className="text-sm font-medium text-muted-foreground">
              {t("totalLabel")}
            </dt>
            <dd className="mt-2 text-[clamp(1.5rem,3vw,2rem)] font-semibold tabular-nums text-foreground">
              {stats.total_last_30d}
            </dd>
          </div>

          {stats.top_categories.length > 0 ? (
            <div className="rounded-2xl border border-border bg-white p-5">
              <dt className="text-sm font-medium text-muted-foreground">
                {t("categoriesLabel")}
              </dt>
              <dd className="mt-3 space-y-2">
                {stats.top_categories.map((item) => (
                  <div
                    key={item.category}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {formatCategoryLabel(item.category)}
                    </span>
                    <span className="tabular-nums font-semibold text-foreground">
                      {item.count}
                    </span>
                  </div>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}
