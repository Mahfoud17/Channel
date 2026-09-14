import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without a session: the login page itself, the
// magic-link/OAuth callback that establishes one, and the whole /api
// surface — those routes are called by external services (an OTA fetching
// a unit's iCal export, a cron scheduler triggering sync) that can't carry
// a browser session, and each one enforces its own auth (a per-unit token,
// a bearer secret) rather than relying on this session check.
const PUBLIC_PATH_PREFIXES = ["/login", "/auth/callback", "/api"];

/**
 * Refreshes the Supabase auth session on every request and redirects signed
 * out users away from protected routes. Wired in src/proxy.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_PATH_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );
  const isPublicAsset = request.nextUrl.pathname.startsWith("/_next");

  if (!user && !isPublicRoute && !isPublicAsset) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
