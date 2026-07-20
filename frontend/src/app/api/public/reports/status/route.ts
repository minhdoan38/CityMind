import { backendEndpoint } from "@/lib/backend";

export async function POST(request: Request) {
  const body = await request.json();

  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  const xff = request.headers.get("x-forwarded-for");
  const xrip = request.headers.get("x-real-ip");

  if (xff) {
    headers.set("X-Forwarded-For", xff);
  } else if (xrip) {
    headers.set("X-Forwarded-For", xrip);
  }

  if (xrip) {
    headers.set("X-Real-Ip", xrip);
  }

  const response = await fetch(backendEndpoint("/api/v1/reports/status"), {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });

  const outbound = new Headers();
  outbound.set(
    "Content-Type",
    response.headers.get("Content-Type") ?? "application/json",
  );
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    outbound.set("Retry-After", retryAfter);
  }

  return new Response(response.body, {
    status: response.status,
    headers: outbound,
  });
}
