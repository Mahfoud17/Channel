"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { syncChannelConnection } from "@/lib/ical/sync";
import type { FormState } from "@/app/actions/reservations";

const CHANNEL_TYPES = ["airbnb", "booking", "vrbo", "other"] as const;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createChannelConnection(
  unitId: string,
  orgSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const channelType = CHANNEL_TYPES.includes(str(formData, "channel_type") as (typeof CHANNEL_TYPES)[number])
    ? str(formData, "channel_type")
    : "other";
  const icalUrl = str(formData, "ical_import_url");

  if (!icalUrl) {
    return { error: "L'URL du flux iCal est obligatoire." };
  }
  try {
    const parsed = new URL(icalUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
  } catch {
    return { error: "URL invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("channel_connections").insert({
    unit_id: unitId,
    channel_type: channelType,
    ical_import_url: icalUrl,
  });

  if (error) {
    return { error: "Impossible d'ajouter cette connexion." };
  }

  revalidatePath(`/org/${orgSlug}/units/${unitId}`);
  return { error: null };
}

export async function deleteChannelConnection(connectionId: string, unitId: string, orgSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("channel_connections").delete().eq("id", connectionId);

  revalidatePath(`/org/${orgSlug}/units/${unitId}`);

  if (error) {
    return { error: "Impossible de supprimer cette connexion." };
  }
  return { error: null };
}

export async function triggerChannelSync(connectionId: string, unitId: string, orgSlug: string) {
  const supabase = await createClient();

  // Confirm the caller can actually see this connection (RLS: org member)
  // before running a sync on the caller's behalf with the service-role
  // client, which would otherwise happily sync anything given an id.
  const { data: connection } = await supabase
    .from("channel_connections")
    .select("id")
    .eq("id", connectionId)
    .maybeSingle();

  if (!connection) {
    return { error: "Connexion introuvable." };
  }

  try {
    const result = await syncChannelConnection(connectionId);
    revalidatePath(`/org/${orgSlug}/units/${unitId}`);
    revalidatePath(`/org/${orgSlug}/calendar`);
    if (result.status === "error") {
      return { error: result.message ?? "La synchronisation a échoué." };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "La synchronisation a échoué." };
  }
}
