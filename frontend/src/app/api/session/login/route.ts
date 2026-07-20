import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnUrl } from "@/lib/safe-return-url";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const returnUrl = safeReturnUrl(
      String(form.get("returnUrl") ?? ""),
      "/dashboard",
    );

    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("error", "1");
      if (returnUrl !== "/dashboard") {
        login.searchParams.set("returnUrl", returnUrl);
      }
      return new NextResponse(null, {
        status: 303,
        headers: { Location: `${login.pathname}${login.search}` },
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
      headers: { Location: returnUrl },
    });
  } catch {
    return new NextResponse(null, {
      status: 303,
      headers: { Location: "/login?error=1" },
    });
  }
}
