import { handleReportsSummaryRequest } from "@/server/services/officer-read";

export async function GET(request: Request) {
  return handleReportsSummaryRequest(request);
}
