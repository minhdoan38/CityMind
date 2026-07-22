import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "officer" | "admin";
export type Session = { role: Role; userId: string };

function roleFromClaims(claims: {
  sub?: string;
  app_metadata?: { role?: string } | Record<string, unknown>;
} | null | undefined): Session | null {
  if (!claims?.sub) return null;
  const role = (claims.app_metadata as { role?: string } | undefined)?.role;
  if (role === "officer" || role === "admin") {
    return { role, userId: claims.sub };
  }
  return null;
}

/** Verify JWT via supabase.auth.getClaims() — do not authorize from getSession() alone. */
export async function getClaims(): Promise<Session | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;
    return roleFromClaims(data.claims);
  } catch {
    return null;
  }
}

export async function getSessionToken(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

export async function requireOfficerSession(): Promise<Session> {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  return claims;
}
