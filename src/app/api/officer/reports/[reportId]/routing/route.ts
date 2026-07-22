import { handleOfficerRoutingOverrideRequest } from "@/server/services/officer-write";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { reportId } = await context.params;
  return handleOfficerRoutingOverrideRequest(request, reportId);
}
