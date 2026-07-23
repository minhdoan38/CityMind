import { handleIntakeMessagesRequest } from "@/server/services/citizen-chat-intake";

export async function GET(request: Request) {
  return handleIntakeMessagesRequest(request);
}

export async function POST(request: Request) {
  return handleIntakeMessagesRequest(request);
}
