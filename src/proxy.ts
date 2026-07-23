import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

/**
 * Compose next-intl locale negotiation with Supabase dashboard gate (AUTH-04 / D-15 / D-17).
 * Protects /dashboard/:path* only — never public Home or [locale] report routes.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // AUTH-04: gate officer dashboard via getClaims (not getSession)
  if (pathname.startsWith('/dashboard')) {
    let supabaseResponse = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
            supabaseResponse = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options);
            });
            Object.entries(headers ?? {}).forEach(([key, value]) => {
              supabaseResponse.headers.set(key, value);
            });
          },
        },
      },
    );

    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;

    if (!claims?.sub) {
      const login = new URL('/login', request.url);
      login.searchParams.set(
        'returnUrl',
        `${pathname}${request.nextUrl.search}`,
      );
      return NextResponse.redirect(login);
    }

    return supabaseResponse;
  }

  // Bypass next-intl for login, api routes, and static assets (dashboard handled above)
  const isBypass =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.');

  if (isBypass) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
