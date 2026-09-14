import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Reads/writes the auth cookies for the current request so RLS policies see
 * the right `auth.uid()`. Call this fresh inside each request — never cache
 * the instance across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component (no cookie write access).
            // Safe to ignore as long as middleware.ts refreshes the
            // session on every request.
          }
        },
      },
    },
  );
}

/**
 * Service-role client for trusted server-only code (scheduled sync jobs,
 * admin operations). This BYPASSES Row Level Security — never expose it to
 * a request path a client can trigger without its own authorization check.
 */
export function createServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    // Fails loudly and specifically instead of letting supabase-js throw an
    // opaque "supabaseKey is required" a few frames down — this key isn't
    // exercised until the first feature that needs it (channel sync,
    // Sprint 4), so a missing value here can otherwise go unnoticed since
    // Sprint 1's setup.
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local — copy it from the Supabase dashboard (Project Settings → API) and restart `pnpm dev`.",
    );
  }
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
