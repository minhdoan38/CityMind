import { handleUpdateReportStatusRequest } from "@/server/services/officer-write";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { reportId } = await context.params;
  return handleUpdateReportStatusRequest(request, reportId);
}
