import { handleGeoPinsRequest } from "@/server/services/officer-read";

export async function GET(request: Request) {
  return handleGeoPinsRequest(request);
}
