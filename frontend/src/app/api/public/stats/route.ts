import { backendEndpoint } from "@/lib/backend";

export async function GET(request: Request) {
  const headers = new Headers();

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

  const response = await fetch(backendEndpoint("/api/v1/public/stats"), {
    method: "GET",
    headers,
    next: { revalidate: 300 },
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
