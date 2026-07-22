import type { SupabaseClient } from "@supabase/supabase-js";

import { getClaims, type Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type OfficerContext = {
  session: Session;
  client: SupabaseClient;
};

export async function requireOfficerContext(): Promise<
  { ok: true; context: OfficerContext } | { ok: false; response: Response }
> {
  const session = await getClaims();
  if (!session) {
    return {
      ok: false,
      response: Response.json({ detail: "Unauthorized" }, { status: 401 }),
    };
  }
  const client = await createClient();
  return { ok: true, context: { session, client } };
}
