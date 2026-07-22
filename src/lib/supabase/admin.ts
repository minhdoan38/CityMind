import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;

/** Service-role client for trusted server-only lookups (e.g. access token hash). */
export function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase admin client is not configured.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getAdminClient(): SupabaseClient {
  if (!cachedAdminClient) {
    cachedAdminClient = createAdminClient();
  }
  return cachedAdminClient;
}

export function resetAdminClientCache(): void {
  cachedAdminClient = null;
}
