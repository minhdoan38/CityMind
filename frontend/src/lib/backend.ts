import "server-only";
import { getSessionToken } from "./auth";

function backendUrl() {
  return (
    process.env.BACKEND_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

export function backendEndpoint(path: string) {
  return `${backendUrl()}${path}`;
}

export async function officerFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = await getSessionToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(backendEndpoint(path), { ...init, headers });
}
