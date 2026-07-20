import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "officer" | "admin";
export type Session = { role: Role; userId: string };

export async function getClaims(): Promise<Session | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const role = user.app_metadata?.role;
    if (role === "officer" || role === "admin") {
      return { role: role as Role, userId: user.id };
    }
    return null;
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
