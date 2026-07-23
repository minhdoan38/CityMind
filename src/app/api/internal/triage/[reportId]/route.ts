import { handleInternalTriageDispatch } from "@/server/triage/dispatch";

type RouteParams = { params: Promise<{ reportId: string }> };

export async function POST(request: Request, context: RouteParams) {
  const { reportId } = await context.params;
  return handleInternalTriageDispatch(request, reportId);
}
