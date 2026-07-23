import { handleOfficerTriageDispatchRequest } from "@/server/services/officer-triage-dispatch";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { reportId } = await context.params;
  return handleOfficerTriageDispatchRequest(reportId);
}
