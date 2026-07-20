import { officerFetch } from "@/lib/backend";
import ReportCard from "@/components/dashboard/ReportCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Report = {
  report_id: string;
  created_at: string;
  category: string;
  priority: string;
  status: string;
  summary: string;
};

type FetchResult<T> = { data: T; error: string | null };

async function getRecentReports(): Promise<FetchResult<Report[]>> {
  try {
    const res = await officerFetch("/api/v1/reports/recent?limit=5", {
      cache: "no-store",
    });
    if (!res.ok) {
      return { data: [], error: `Could not load reports (HTTP ${res.status}).` };
    }
    const body = await res.json();
    return { data: body.items ?? [], error: null };
  } catch {
    return { data: [], error: "Could not connect to the CityMind API." };
  }
}

export default async function DashboardPage() {
  const result = await getRecentReports();
  const reports = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Officer dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Recent community reports for review.
        </p>
      </div>

      {result.error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Could not load reports. Check your connection and try again.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {reports.map((report) => (
          <ReportCard key={report.report_id} report={report} />
        ))}

        {!result.error && reports.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            <p className="text-lg font-medium">No reports yet</p>
            <p className="mt-1 text-sm">
              Citizen reports will show up here after submission.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
