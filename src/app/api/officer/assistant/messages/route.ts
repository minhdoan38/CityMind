import {
  handleOfficerAssistantListRequest,
  handleOfficerAssistantMessageRequest,
} from "@/server/services/officer-assistant";

export async function GET(request: Request) {
  return handleOfficerAssistantListRequest(request);
}

export async function POST(request: Request) {
  return handleOfficerAssistantMessageRequest(request);
}
