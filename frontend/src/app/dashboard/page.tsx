import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { officerFetch } from "@/lib/backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const t = await getTranslations("dashboard");
  const tError = await getTranslations("error");
  
  const result = await getRecentReports();
  const reports = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      {result.error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{tError("apiConnection")}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.report_id} className="border border-border shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg font-semibold capitalize">
                  {report.category || "Uncategorized"}
                </CardTitle>
                <CardDescription className="text-xs">
                  ID: {report.report_id}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
                  {report.priority}
                </span>
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
                  {report.status || "new"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground">{report.summary}</p>
              <div>
                <Link
                  href={`/dashboard/reports/${report.report_id}`}
                  className="inline-flex items-center justify-center min-h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition-colors"
                >
                  View details
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}

        {!result.error && reports.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            <p className="text-lg font-medium">No reports to show yet</p>
            <p className="text-sm mt-1">Seeded or submitted community incidents will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
