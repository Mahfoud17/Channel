import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components. Safe to call on every render —
 * createBrowserClient reuses a single instance under the hood.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
