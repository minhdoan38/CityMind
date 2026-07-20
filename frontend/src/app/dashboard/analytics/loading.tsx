import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="w-full max-w-none space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-full max-w-2xl" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="min-h-[240px] w-full" />
        <Skeleton className="min-h-[240px] w-full" />
      </div>
      <Skeleton className="min-h-[240px] w-full" />
      <Skeleton className="min-h-48 w-full" />
    </div>
  );
}
