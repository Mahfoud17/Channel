"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error: string | null };

function revalidateCleaning(orgSlug: string) {
  revalidatePath(`/org/${orgSlug}/cleaning`);
}

export async function assignCleaningTask(
  taskId: string,
  cleanerId: string,
  orgSlug: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaning_tasks")
    .update({ assigned_to: cleanerId, status: "proposed" })
    .eq("id", taskId);

  revalidateCleaning(orgSlug);
  if (error) return { error: "Impossible d'attribuer cette tâche." };
  return { error: null };
}

export async function acceptCleaningTask(taskId: string, orgSlug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaning_tasks")
    .update({ status: "accepted" })
    .eq("id", taskId)
    .eq("status", "proposed");

  revalidateCleaning(orgSlug);
  if (error) return { error: "Impossible d'accepter la mission." };
  return { error: null };
}

export async function declineCleaningTask(taskId: string, orgSlug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaning_tasks")
    .update({ status: "unassigned", assigned_to: null })
    .eq("id", taskId)
    .eq("status", "proposed");

  revalidateCleaning(orgSlug);
  if (error) return { error: "Impossible de refuser la mission." };
  return { error: null };
}

export async function startCleaningTask(taskId: string, orgSlug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaning_tasks")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("status", "accepted");

  revalidateCleaning(orgSlug);
  if (error) return { error: "Impossible de démarrer le ménage." };
  return { error: null };
}

export async function completeCleaningTask(
  taskId: string,
  orgSlug: string,
  checklistResults: Record<string, boolean>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaning_tasks")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      checklist_results: checklistResults,
    })
    .eq("id", taskId)
    .eq("status", "in_progress");

  revalidateCleaning(orgSlug);
  if (error) return { error: "Impossible de terminer le ménage." };
  return { error: null };
}

export async function reportCleaningIssue(
  taskId: string,
  orgSlug: string,
  description: string,
  photoStoragePath: string | null,
): Promise<ActionResult> {
  if (!description.trim()) {
    return { error: "Décris le problème avant d'envoyer." };
  }

  const supabase = await createClient();

  const { error: issueError } = await supabase.from("cleaning_issues").insert({
    task_id: taskId,
    description: description.trim(),
    photo_storage_path: photoStoragePath,
  });

  if (issueError) {
    return { error: "Impossible d'envoyer le signalement." };
  }

  await supabase.from("cleaning_tasks").update({ status: "problem" }).eq("id", taskId);

  revalidateCleaning(orgSlug);
  return { error: null };
}

export async function saveChecklistTemplate(
  unitId: string,
  orgSlug: string,
  items: string[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaning_checklists")
    .upsert({ unit_id: unitId, items }, { onConflict: "unit_id" });

  revalidatePath(`/org/${orgSlug}/units/${unitId}`);
  if (error) return { error: "Impossible d'enregistrer la checklist." };
  return { error: null };
}
