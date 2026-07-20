import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type ReportCardData = {
  report_id: string;
  category: string;
  priority: string;
  status: string;
  summary: string;
};

type Props = {
  report: ReportCardData;
};

export default function ReportCard({ report }: Props) {
  const category = report.category || "Uncategorized";
  const priority = report.priority || "unknown";
  const status = report.status || "new";

  return (
    <Card className="border border-border shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold capitalize">
            {category}
          </CardTitle>
          <CardDescription className="text-xs">
            ID: {report.report_id}
          </CardDescription>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold capitalize text-primary">
            Priority: {priority}
          </span>
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold capitalize text-primary">
            Status: {status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground">{report.summary}</p>
        <Link
          href={`/dashboard/reports/${report.report_id}`}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          View details
        </Link>
      </CardContent>
    </Card>
  );
}
