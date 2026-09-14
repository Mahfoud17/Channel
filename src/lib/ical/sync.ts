import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseIcalEvents } from "@/lib/ical/parse";

const CHANNEL_LABELS: Record<string, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  vrbo: "Vrbo",
  other: "Autre plateforme",
};

// PostgreSQL exclusion_violation — raised by reservations_no_overlap
// (migration 0006). An imported OTA event landing here means it genuinely
// overlaps something already on the calendar (a manual booking, or another
// channel's import) — a real conflict to surface, not a bug to swallow.
const EXCLUSION_VIOLATION = "23P01";

export type SyncResult = {
  status: "ok" | "error";
  message: string | null;
  eventsSeen: number;
  eventsImported: number;
  eventsCancelled: number;
  conflicts: number;
};

/**
 * Pulls one channel connection's iCal feed and reconciles it against our
 * reservations: new events are imported, events that disappeared from the
 * feed are cancelled (the guest cancelled on the OTA's side), and existing
 * ones have their dates refreshed. Runs with the service-role client —
 * this is exactly the "trusted server-side code" case that key is reserved
 * for (see src/lib/supabase/server.ts).
 */
export async function syncChannelConnection(connectionId: string): Promise<SyncResult> {
  const supabase = createServiceRoleClient();
  const startedAt = new Date().toISOString();

  const { data: connection, error: connectionError } = await supabase
    .from("channel_connections")
    .select("id, unit_id, organization_id, channel_type, ical_import_url")
    .eq("id", connectionId)
    .maybeSingle();

  if (connectionError || !connection) {
    throw new Error("Connexion introuvable.");
  }

  const result = { eventsSeen: 0, eventsImported: 0, eventsCancelled: 0, conflicts: 0 };
  let status: "ok" | "error" = "ok";
  let message: string | null = null;

  try {
    const response = await fetch(connection.ical_import_url, {
      headers: { "User-Agent": "ChannelManager/1.0 (+ical-sync)" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Le flux a répondu avec le statut ${response.status}.`);
    }

    const events = parseIcalEvents(await response.text());
    result.eventsSeen = events.length;
    const channelLabel = CHANNEL_LABELS[connection.channel_type] ?? connection.channel_type;

    const { data: existing } = await supabase
      .from("reservations")
      .select("id, external_id, check_in, check_out")
      .eq("unit_id", connection.unit_id)
      .eq("source", connection.channel_type)
      .not("external_id", "is", null)
      .neq("status", "cancelled");

    const existingRows = existing ?? [];
    const existingByUid = new Map(existingRows.map((r) => [r.external_id as string, r]));
    const feedUids = new Set(events.map((e) => e.uid));

    // Previously-imported reservations no longer in the feed were
    // cancelled on the OTA's side.
    for (const reservation of existingRows) {
      if (reservation.external_id && !feedUids.has(reservation.external_id)) {
        await supabase
          .from("reservations")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", reservation.id);
        result.eventsCancelled += 1;
      }
    }

    for (const event of events) {
      const existingReservation = existingByUid.get(event.uid);

      if (!existingReservation) {
        const { error: insertError } = await supabase.from("reservations").insert({
          unit_id: connection.unit_id,
          guest_first_name: channelLabel,
          guest_last_name: "(iCal)",
          check_in: event.start,
          check_out: event.end,
          status: "confirmed",
          source: connection.channel_type,
          external_id: event.uid,
          notes: `Importé automatiquement depuis ${channelLabel}. iCal ne transmet ni le nom ni le prix du voyageur.`,
        });
        if (insertError) {
          if (insertError.code === EXCLUSION_VIOLATION) {
            result.conflicts += 1;
          } else {
            throw insertError;
          }
        } else {
          result.eventsImported += 1;
        }
        continue;
      }

      if (
        existingReservation.check_in !== event.start ||
        existingReservation.check_out !== event.end
      ) {
        const { error: updateError } = await supabase
          .from("reservations")
          .update({ check_in: event.start, check_out: event.end })
          .eq("id", existingReservation.id);
        if (updateError) {
          if (updateError.code === EXCLUSION_VIOLATION) {
            result.conflicts += 1;
          } else {
            throw updateError;
          }
        }
      }
    }
  } catch (err) {
    status = "error";
    message = err instanceof Error ? err.message : "Erreur inconnue.";
  }

  if (result.conflicts > 0 && status === "ok") {
    status = "error";
    message = `${result.conflicts} réservation(s) importée(s) entrent en conflit avec le calendrier existant — résolution manuelle nécessaire.`;
  }

  await supabase
    .from("channel_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_message: message,
    })
    .eq("id", connectionId);

  await supabase.from("sync_logs").insert({
    channel_connection_id: connectionId,
    organization_id: connection.organization_id,
    status,
    events_seen: result.eventsSeen,
    events_imported: result.eventsImported,
    events_cancelled: result.eventsCancelled,
    conflicts: result.conflicts,
    message,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });

  if (status === "error") {
    // The only notification that can't be a DB trigger — it originates
    // from an external fetch failing, not from a row changing.
    await supabase.from("notifications").insert({
      organization_id: connection.organization_id,
      type: "sync_failed",
      title: "Synchronisation échouée",
      body: `${CHANNEL_LABELS[connection.channel_type] ?? connection.channel_type} — ${message ?? "erreur inconnue"}`,
      link: `/units/${connection.unit_id}`,
    });
  }

  return { status, message, ...result };
}
