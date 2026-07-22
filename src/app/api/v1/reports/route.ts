import { handleSubmitReportRequest } from "@/server/services/report-service";

export async function POST(request: Request) {
  return handleSubmitReportRequest(request);
}
