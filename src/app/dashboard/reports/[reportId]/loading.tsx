import { Skeleton } from "@/components/ui/skeleton";

export default function ReportDetailLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Skeleton className="h-4 w-40" />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </header>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-secondary/40 p-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-lg border border-border p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </section>

      <section className="space-y-3 rounded-lg border border-border p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="min-h-48 w-full rounded-md" />
        <Skeleton className="h-4 w-2/3" />
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-[#EFF6FF] p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </section>

      <section className="space-y-3 rounded-lg border border-border p-6">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </section>

      <section className="space-y-3 rounded-lg border border-border p-6">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-6">
        <Skeleton className="h-6 w-44" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-11 w-36" />
          <Skeleton className="h-11 w-32" />
          <Skeleton className="h-11 w-32" />
        </div>
      </section>
    </div>
  );
}
