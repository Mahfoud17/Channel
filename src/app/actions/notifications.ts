"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(notificationId: string, orgSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  revalidatePath(`/org/${orgSlug}/notifications`);
  revalidatePath(`/org/${orgSlug}/dashboard`);
  if (error) return { error: "Impossible de marquer comme lu." };
  return { error: null };
}

export async function markAllNotificationsRead(orgSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  revalidatePath(`/org/${orgSlug}/notifications`);
  revalidatePath(`/org/${orgSlug}/dashboard`);
  if (error) return { error: "Impossible de tout marquer comme lu." };
  return { error: null };
}
