import { Skeleton } from "@/components/ui/skeleton";

import ReportsTableSkeleton from "@/components/reports/ReportsTableSkeleton";

export default function DashboardLoading() {
  return (
    <div className="w-full max-w-none space-y-6" aria-busy="true" aria-live="polite">
      <div className="dash-rise flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 animate-none skeleton-shimmer" />
          <Skeleton className="h-5 w-full max-w-2xl animate-none skeleton-shimmer" />
        </div>
        <div className="dash-rise dash-rise-delay-1 flex w-full flex-wrap items-center gap-2 sm:gap-3 lg:w-auto lg:justify-end">
          <Skeleton className="h-10 w-full animate-none skeleton-shimmer rounded-[var(--radius-control)] sm:w-52" />
          <Skeleton className="h-10 w-28 animate-none skeleton-shimmer rounded-[var(--radius-control)]" />
          <Skeleton className="h-10 w-36 animate-none skeleton-shimmer rounded-[var(--radius-control)]" />
        </div>
      </div>

      <Skeleton className="h-10 w-full animate-none skeleton-shimmer rounded-[var(--radius-control)]" />

      <div className="dash-rise dash-rise-delay-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface-card space-y-3 p-5">
            <Skeleton className="h-4 w-24 animate-none skeleton-shimmer" />
            <Skeleton className="h-8 w-20 animate-none skeleton-shimmer" />
          </div>
        ))}
      </div>

      <div className="dash-rise dash-rise-delay-3">
        <ReportsTableSkeleton />
      </div>
    </div>
  );
}
