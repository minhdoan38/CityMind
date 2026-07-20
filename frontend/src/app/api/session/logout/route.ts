import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore error on logout
  }

  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/login" },
  });
}
