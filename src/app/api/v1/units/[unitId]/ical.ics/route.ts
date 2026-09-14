import { createServiceRoleClient } from "@/lib/supabase/server";
import { buildIcal } from "@/lib/ical/parse";
import { NextResponse } from "next/server";

// Public endpoint: this is the URL an OTA's calendar-import feature fetches
// on its own schedule, so it cannot carry a user session. Security is the
// unguessable per-unit token (see the ?token= check below and
// units.ical_export_token in migration 0007) — same trade-off as unit
// photos, documented in docs/architecture section C.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ unitId: string }> },
) {
  const { unitId } = await params;
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: unit } = await supabase
    .from("units")
    .select("id, name, ical_export_token")
    .eq("id", unitId)
    .maybeSingle();

  if (!unit || unit.ical_export_token !== token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, check_in, check_out")
    .eq("unit_id", unitId)
    .neq("status", "cancelled");

  const ics = buildIcal(
    (reservations ?? []).map((r) => ({
      uid: `${r.id}@channel-manager`,
      start: r.check_in,
      end: r.check_out,
      summary: "Réservé",
    })),
    unit.name,
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${unit.id}.ics"`,
      "Cache-Control": "public, max-age=900", // 15 min — polling feeds don't need it fresher
    },
  });
}
