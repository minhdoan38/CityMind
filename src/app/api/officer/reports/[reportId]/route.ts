import { handleDeleteReportRequest } from "@/server/services/officer-write";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { reportId } = await context.params;
  return handleDeleteReportRequest(reportId);
}
