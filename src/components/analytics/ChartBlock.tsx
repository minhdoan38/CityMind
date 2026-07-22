import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  title: string;
  caption: string;
  summary?: string;
  loading?: boolean;
  emptyHeading?: string;
  emptyBody?: string;
  isEmpty?: boolean;
  children?: ReactNode;
};

export default function ChartBlock({
  title,
  caption,
  summary,
  loading,
  emptyHeading,
  emptyBody,
  isEmpty,
  children,
}: Props) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] md:p-6">
      <div className="mb-4 space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{caption}</p>
        {summary ? (
          <p className="sr-only">{summary}</p>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="min-h-[200px] w-full md:min-h-[240px]" />
      ) : isEmpty ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center md:min-h-[240px]">
          <p className="text-base font-semibold text-foreground">{emptyHeading}</p>
          <p className="max-w-md text-sm text-muted-foreground">{emptyBody}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
