"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/reservations";

const TRIGGER_TYPES = [
  "on_created",
  "before_checkin",
  "after_checkin",
  "before_checkout",
  "after_checkout",
] as const;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createMessageTemplate(
  orgId: string,
  orgSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData, "name");
  const triggerType = str(formData, "trigger_type");
  const body = str(formData, "body");

  if (!name || !body) {
    return { error: "Le nom et le contenu du message sont obligatoires." };
  }
  if (!TRIGGER_TYPES.includes(triggerType as (typeof TRIGGER_TYPES)[number])) {
    return { error: "Déclencheur invalide." };
  }

  const offsetDays = Math.max(0, Math.round(Number(str(formData, "offset_days")) || 0));

  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").insert({
    organization_id: orgId,
    name,
    trigger_type: triggerType,
    offset_days: offsetDays,
    subject: str(formData, "subject") || null,
    body,
  });

  if (error) {
    return { error: "Impossible de créer ce modèle." };
  }

  revalidatePath(`/org/${orgSlug}/messages`);
  return { error: null };
}

export async function deleteMessageTemplate(templateId: string, orgSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").delete().eq("id", templateId);

  revalidatePath(`/org/${orgSlug}/messages`);
  if (error) return { error: "Impossible de supprimer ce modèle." };
  return { error: null };
}

export async function toggleMessageTemplate(templateId: string, orgSlug: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("message_templates")
    .update({ is_active: isActive })
    .eq("id", templateId);

  revalidatePath(`/org/${orgSlug}/messages`);
  if (error) return { error: "Impossible de mettre à jour ce modèle." };
  return { error: null };
}

export async function markMessageSent(messageId: string, orgSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("scheduled_messages")
    .update({ status: "sent", sent_at: new Date().toISOString(), sent_by: user?.id ?? null })
    .eq("id", messageId)
    .eq("status", "pending");

  revalidatePath(`/org/${orgSlug}/messages`);
  if (error) return { error: "Impossible de marquer ce message comme envoyé." };
  return { error: null };
}

export async function cancelScheduledMessage(messageId: string, orgSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scheduled_messages")
    .update({ status: "cancelled" })
    .eq("id", messageId)
    .eq("status", "pending");

  revalidatePath(`/org/${orgSlug}/messages`);
  if (error) return { error: "Impossible d'annuler ce message." };
  return { error: null };
}
