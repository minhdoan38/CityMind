import { Skeleton } from "@/components/ui/skeleton";

export default function ReportDetailLoading() {
  return (
    <div className="reports-detail">
      <Skeleton className="h-4 w-36" />

      <header className="reports-detail-hero space-y-3">
        <Skeleton className="h-9 w-full max-w-lg" />
        <Skeleton className="h-4 w-56" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-72" />
      </header>

      <div className="reports-detail-metrics-wrap space-y-3">
        <div className="reports-detail-metrics surface-card">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
        <div className="reports-detail-impact surface-card space-y-2 p-5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </div>

      <div className="reports-detail-grid">
        <aside className="reports-detail-aside">
          <div className="reports-detail-aside-card space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        </aside>
        <div className="reports-detail-main space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <section key={index} className="reports-detail-section space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
