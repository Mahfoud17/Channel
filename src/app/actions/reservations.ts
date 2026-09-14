"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type FormState = { error: string | null };

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string): number {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : 0;
}

// PostgreSQL's exclusion_violation code — raised by the reservations_no_overlap
// constraint in 0006_calendar_and_reservations.sql. This is the actual
// anti-double-booking guarantee; everything else here is just a friendlier
// error message on top of it.
const EXCLUSION_VIOLATION = "23P01";

export async function createReservation(
  unitId: string,
  orgSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const guestFirstName = str(formData, "guest_first_name");
  const guestLastName = str(formData, "guest_last_name");
  const checkIn = str(formData, "check_in");
  const checkOut = str(formData, "check_out");

  if (!guestFirstName || !guestLastName || !checkIn || !checkOut) {
    return { error: "Prénom, nom et dates d'arrivée/départ sont obligatoires." };
  }
  if (checkOut <= checkIn) {
    return { error: "La date de départ doit être après la date d'arrivée." };
  }

  const supabase = await createClient();

  // Best-effort UX check against manual blocks — the database constraint
  // only protects reservations against each other (see migration), a block
  // overlap here isn't a double-booking risk, just worth flagging early.
  const { data: overlappingBlock } = await supabase
    .from("calendar_blocks")
    .select("id")
    .eq("unit_id", unitId)
    .lt("start_date", checkOut)
    .gt("end_date", checkIn)
    .maybeSingle();

  if (overlappingBlock) {
    return { error: "Ces dates chevauchent une période bloquée sur ce logement." };
  }

  const { error } = await supabase.from("reservations").insert({
    unit_id: unitId,
    guest_first_name: guestFirstName,
    guest_last_name: guestLastName,
    guest_email: str(formData, "guest_email") || null,
    guest_phone: str(formData, "guest_phone") || null,
    num_guests: Math.max(1, num(formData, "num_guests") || 1),
    check_in: checkIn,
    check_out: checkOut,
    nightly_price: num(formData, "nightly_price"),
    cleaning_fee: num(formData, "cleaning_fee"),
    notes: str(formData, "notes") || null,
  });

  if (error) {
    if (error.code === EXCLUSION_VIOLATION) {
      return { error: "Ces dates chevauchent déjà une réservation existante pour ce logement." };
    }
    return { error: "Impossible de créer la réservation. Réessaie." };
  }

  revalidatePath(`/org/${orgSlug}/calendar`);
  return { error: null };
}

export async function cancelReservation(reservationId: string, orgSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", reservationId);

  revalidatePath(`/org/${orgSlug}/calendar`);
  revalidatePath(`/org/${orgSlug}/reservations/${reservationId}`);

  if (error) {
    return { error: "Impossible d'annuler la réservation." };
  }
  return { error: null };
}
