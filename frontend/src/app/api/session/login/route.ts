import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !user) {
      return new NextResponse(null, {
        status: 303,
        headers: { Location: "/login?error=1" },
      });
    }

    const role = user.app_metadata?.role;
    if (role !== "officer" && role !== "admin") {
      await supabase.auth.signOut();
      return new NextResponse(null, {
        status: 303,
        headers: { Location: "/login?error=1" },
      });
    }

    return new NextResponse(null, {
      status: 303,
      headers: { Location: "/dashboard" },
    });
  } catch {
    return new NextResponse(null, {
      status: 303,
      headers: { Location: "/login?error=1" },
    });
  }
}
