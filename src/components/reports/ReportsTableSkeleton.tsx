import type { CSSProperties } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TABLE_ROWS = Array.from({ length: 9 });
const HEADER_COLUMNS = ["w-8", "w-28", "w-12", "w-20", "w-16", "w-14", "w-16", "w-10"];

function Shimmer({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn("animate-none skeleton-shimmer rounded-md bg-muted", className)}
    />
  );
}

export default function ReportsTableSkeleton() {
  return (
    <div className="surface-card overflow-hidden" aria-hidden>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Shimmer className="h-5 w-32" />
          <Shimmer className="h-9 w-28 rounded-lg" />
        </div>
        <Shimmer className="size-9 rounded-lg" />
      </header>

      <div className="border-b border-dashed border-border bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-4">
          {HEADER_COLUMNS.map((width, index) => (
            <Shimmer key={index} className={cn("h-4", width)} />
          ))}
        </div>
      </div>

      <div className="divide-y divide-dashed divide-border">
        {TABLE_ROWS.map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="table-skeleton-row flex h-14 items-center gap-4 px-5"
            style={{ "--row-i": rowIndex } as CSSProperties}
          >
            <Shimmer className="size-4 rounded-sm" />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Shimmer className="size-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Shimmer className="h-3.5 w-28" />
                <Shimmer className="h-3 w-36 max-w-full" />
              </div>
            </div>
            <Shimmer className="h-5 w-10 rounded-full" />
            <Shimmer className="hidden h-4 w-20 lg:block" />
            <Shimmer className="hidden h-4 w-14 lg:block" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="hidden h-5 w-14 rounded-full md:block" />
            <Shimmer className="hidden h-5 w-16 rounded-full sm:block" />
            <Shimmer className="hidden h-4 w-32 xl:block" />
            <Shimmer className="size-8 rounded-lg opacity-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
