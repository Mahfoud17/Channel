import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncChannelConnection } from "@/lib/ical/sync";
import { NextResponse } from "next/server";

// Bulk sync entry point for an external scheduler (Vercel Cron once
// deployed — see vercel.json — or a manual curl in the meantime). Protected
// by a shared secret rather than a user session, since nothing here is
// triggered by a browser. Set CRON_SECRET in the environment before relying
// on this in production; without it the endpoint refuses every request.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: connections, error } = await supabase
    .from("channel_connections")
    .select("id")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: "Failed to list connections" }, { status: 500 });
  }

  const results = await Promise.allSettled(
    (connections ?? []).map((c) => syncChannelConnection(c.id)),
  );

  const summary = {
    total: results.length,
    ok: results.filter((r) => r.status === "fulfilled" && r.value.status === "ok").length,
    failed: results.filter((r) => r.status === "rejected" || r.value.status === "error").length,
  };

  return NextResponse.json(summary);
}
