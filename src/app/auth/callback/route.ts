import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Handles the redirect from a Supabase magic-link / OAuth sign-in and
// exchanges the one-time code for a session. Not used by the password
// sign-in flow on /login, but wired in from the start so magic links and
// OAuth providers can be turned on later without touching routing.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
