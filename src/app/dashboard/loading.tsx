import { Skeleton } from "@/components/ui/skeleton";

const TABLE_ROWS = Array.from({ length: 9 });

export default function DashboardLoading() {
  return (
    <div className="w-full max-w-none space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <Skeleton className="h-11 w-52 rounded-xl" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
      </div>

      <Skeleton className="h-11 w-full rounded-xl" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface-card space-y-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>

      <div className="surface-card overflow-hidden">
        <div className="grid grid-cols-6 gap-3 border-b border-border bg-muted/50 px-4 py-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
        <div className="divide-y divide-border">
          {TABLE_ROWS.map((_, index) => (
            <div key={index} className="grid grid-cols-6 gap-3 px-4 py-3">
              {Array.from({ length: 6 }).map((__, cellIndex) => (
                <Skeleton key={cellIndex} className="h-5 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
