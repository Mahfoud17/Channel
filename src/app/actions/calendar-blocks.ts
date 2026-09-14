"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/reservations";

const EXCLUSION_VIOLATION = "23P01";
const REASONS = ["maintenance", "owner", "other"] as const;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createCalendarBlock(
  unitId: string,
  orgSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const startDate = str(formData, "start_date");
  const endDate = str(formData, "end_date");
  const reason = REASONS.includes(str(formData, "reason") as (typeof REASONS)[number])
    ? str(formData, "reason")
    : "other";

  if (!startDate || !endDate) {
    return { error: "Les deux dates sont obligatoires." };
  }
  if (endDate <= startDate) {
    return { error: "La date de fin doit être après la date de début." };
  }

  const supabase = await createClient();

  const { data: overlappingReservation } = await supabase
    .from("reservations")
    .select("id")
    .eq("unit_id", unitId)
    .neq("status", "cancelled")
    .lt("check_in", endDate)
    .gt("check_out", startDate)
    .maybeSingle();

  if (overlappingReservation) {
    return { error: "Ces dates chevauchent une réservation existante sur ce logement." };
  }

  const { error } = await supabase.from("calendar_blocks").insert({
    unit_id: unitId,
    start_date: startDate,
    end_date: endDate,
    reason,
    notes: str(formData, "notes") || null,
  });

  if (error) {
    if (error.code === EXCLUSION_VIOLATION) {
      return { error: "Ces dates chevauchent déjà un autre blocage sur ce logement." };
    }
    return { error: "Impossible de créer le blocage. Réessaie." };
  }

  revalidatePath(`/org/${orgSlug}/calendar`);
  return { error: null };
}

export async function deleteCalendarBlock(blockId: string, orgSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_blocks").delete().eq("id", blockId);

  revalidatePath(`/org/${orgSlug}/calendar`);

  if (error) {
    return { error: "Impossible de supprimer le blocage." };
  }
  return { error: null };
}
