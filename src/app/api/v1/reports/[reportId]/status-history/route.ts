import { handleStatusHistoryRequest } from "@/server/services/officer-read";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { reportId } = await context.params;
  return handleStatusHistoryRequest(request, reportId);
}
