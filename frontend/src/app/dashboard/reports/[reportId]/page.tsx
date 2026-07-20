import Link from "next/link";
import CopyStatusLink from "@/components/CopyStatusLink";
import StatusActions from "@/components/StatusActions";
import { requireOfficerSession } from "@/lib/auth";
import { officerFetch } from "@/lib/backend";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = { params: Promise<{ reportId: string }> };

type Report = {
  report_id: string;
  created_at: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  category: string;
  severity: number;
  confidence: number;
  summary: string;
  recommendation: string;
  priority: string;
  estimated_impact?: string;
  evidence?: string[];
  uncertainty?: string[];
  urban_context?: string | Record<string, unknown> | null;
  image_gcs_uri?: string | null;
  status?: string;
  status_note?: string | null;
};

type StatusEvent = {
  status: string;
  note?: string | null;
  created_at: string;
};

type FetchResult<T> =
  | { data: T; error: null; notFound?: false }
  | { data: null; error: string; notFound?: boolean };

async function getReport(reportId: string): Promise<FetchResult<Report>> {
  try {
    const res = await officerFetch(`/api/v1/reports/${reportId}`, {
      cache: "no-store",
    });
    if (res.status === 404) {
      return { data: null, error: "Report not found.", notFound: true };
    }
    if (!res.ok) {
      return { data: null, error: `Could not load report (HTTP ${res.status}).` };
    }
    return { data: await res.json(), error: null };
  } catch {
    return { data: null, error: "Could not connect to the CityMind API." };
  }
}

async function getHistory(reportId: string): Promise<FetchResult<StatusEvent[]>> {
  try {
    const res = await officerFetch(
      `/api/v1/reports/${reportId}/status-history`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      return {
        data: null,
        error: `Could not load status history (HTTP ${res.status}).`,
      };
    }
    const body = await res.json();
    return { data: body.items ?? [], error: null };
  } catch {
    return { data: null, error: "Could not connect to the history service." };
  }
}

function parseUrbanContext(
  value: Report["urban_context"],
): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return { context: value };
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB");
}

function SignalList({ items }: { items?: string[] }) {
  if (!items?.length) {
    return <p className="mt-2 text-sm text-muted-foreground">None recorded.</p>;
  }
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

export default async function ReportDetail({ params }: Props) {
  await requireOfficerSession();
  const { reportId } = await params;
  const [reportResult, historyResult] = await Promise.all([
    getReport(reportId),
    getHistory(reportId),
  ]);

  if (!reportResult.data) {
    return (
      <Card className="border border-border p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold">
          {reportResult.notFound ? "Report not found" : "Report unavailable"}
        </h1>
        <p className="mt-2 text-muted-foreground">{reportResult.error}</p>
        <Link href="/dashboard" className="mt-5 inline-block text-primary hover:underline">
          ← Back to dashboard
        </Link>
      </Card>
    );
  }

  const report = reportResult.data;
  const history = historyResult.data ?? [];
  const urbanContext = parseUrbanContext(report.urban_context);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link href="/dashboard" className="text-sm font-semibold text-primary hover:underline">
        ← Back to dashboard
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold capitalize tracking-tight">
            {report.category || "Uncategorized report"}
          </h1>
          <p className="mt-2 break-all text-xs text-muted-foreground">ID: {report.report_id}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted {formatDate(report.created_at)}
          </p>
          <CopyStatusLink reportId={report.report_id} />
        </div>
        <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-primary capitalize">
          Status: {report.status ?? "new"}
        </span>
      </header>

      <Alert className="border border-primary bg-secondary/50">
        <AlertDescription className="text-foreground text-sm font-medium">
          AI-generated analysis is advisory. An officer remains responsible for
          verification and the final decision.
        </AlertDescription>
      </Alert>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-6 space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[
              ["Priority", report.priority],
              ["Severity", `${report.severity}/5`],
              ["Confidence", `${Math.round(report.confidence * 100)}%`],
              ["Impact", report.estimated_impact || "Not available"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs uppercase text-muted-foreground font-semibold">{label}</p>
                <p className="mt-1 font-semibold capitalize text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {report.description && (
            <section className="border-t border-border pt-5 space-y-2">
              <h2 className="font-semibold text-foreground">Citizen report</h2>
              <p className="whitespace-pre-wrap text-sm text-foreground">{report.description}</p>
            </section>
          )}

          <section className="border-t border-border pt-5 space-y-2">
            <h2 className="font-semibold text-foreground">AI summary</h2>
            <p className="text-sm text-foreground">{report.summary}</p>
          </section>

          <section className="border-t border-border pt-5 space-y-2">
            <h2 className="font-semibold text-foreground">Recommended action</h2>
            <p className="text-sm text-foreground">{report.recommendation}</p>
          </section>

          <div className="grid gap-6 border-t border-border pt-5 md:grid-cols-2">
            <section>
              <h2 className="font-semibold text-foreground">Evidence signals</h2>
              <SignalList items={report.evidence} />
            </section>
            <section>
              <h2 className="font-semibold text-foreground">Uncertainty</h2>
              <SignalList items={report.uncertainty} />
            </section>
          </div>

          {(report.latitude != null || report.longitude != null) && (
            <section className="border-t border-border pt-5 space-y-2">
              <h2 className="font-semibold text-foreground">Reported location</h2>
              <p className="text-sm text-foreground">
                Latitude: {report.latitude ?? "not provided"} · Longitude:{" "}
                {report.longitude ?? "not provided"}
              </p>
            </section>
          )}

          {report.image_gcs_uri && (
            <section className="border-t border-border pt-5 space-y-2">
              <h2 className="mb-3 font-semibold text-foreground">Evidence image</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/officer/reports/${report.report_id}/image`}
                alt="Citizen-provided report evidence"
                className="max-h-96 rounded-md border border-border object-contain"
              />
            </section>
          )}

          <section className="border-t border-border pt-5 space-y-2">
            <h2 className="font-semibold text-foreground">Officer action</h2>
            {report.status_note && (
              <p className="text-sm text-muted-foreground">
                Latest note: {report.status_note}
              </p>
            )}
            <StatusActions reportId={report.report_id} currentStatus={report.status} />
          </section>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm p-6 space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Urban context</h2>
        <p className="text-sm text-muted-foreground">
          Supporting context only; it is not a prediction or verified incident fact.
        </p>
        {urbanContext && Object.keys(urbanContext).length > 0 ? (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-secondary p-4 text-xs font-mono text-foreground border border-border">
            {JSON.stringify(urbanContext, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            No urban context was recorded for this report.
          </p>
        )}
      </Card>

      <Card className="border border-border shadow-sm p-6 space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Status history</h2>
        {historyResult.error && (
          <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {historyResult.error}
          </p>
        )}
        {!historyResult.error && history.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No status changes yet. This report is currently new.
          </p>
        )}
        <ol className="grid gap-3">
          {history.map((item) => (
            <li
              key={`${item.status}-${item.created_at}`}
              className="rounded-md border border-border bg-secondary/50 p-4 space-y-1"
            >
              <p className="font-semibold capitalize text-foreground">{item.status}</p>
              <p className="text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
              {item.note && <p className="mt-2 text-sm text-foreground">{item.note}</p>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
