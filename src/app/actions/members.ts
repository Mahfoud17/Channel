"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/reservations";

const ROLES = ["admin", "manager", "cleaner", "owner"] as const;

export async function addMemberByEmail(
  orgId: string,
  orgSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleInput = String(formData.get("role") ?? "");
  const role = ROLES.includes(roleInput as (typeof ROLES)[number]) ? roleInput : "cleaner";

  if (!email) {
    return { error: "L'email est obligatoire." };
  }

  const supabase = await createClient();

  // No invite-by-email flow yet (would need transactional email) — the
  // person must already have an account. profiles.email lets us find their
  // user id without touching auth.users directly. This lookup deliberately
  // uses the service-role client: profiles RLS only shows you people who
  // already share an organization with you, which is exactly the case that
  // doesn't hold yet for someone you're trying to add for the first time.
  // The actual organization_members insert just below still goes through
  // the normal client, so RLS still enforces that only an admin can do it.
  const { data: profile } = await createServiceRoleClient()
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return {
      error:
        "Aucun compte avec cet email. Cette personne doit d'abord créer un compte sur la page de connexion, puis tu pourras l'ajouter ici.",
    };
  }

  const { error } = await supabase.from("organization_members").insert({
    organization_id: orgId,
    user_id: profile.id,
    role,
    status: "active",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Cette personne fait déjà partie de l'organisation." };
    }
    return { error: "Impossible d'ajouter ce membre." };
  }

  revalidatePath(`/org/${orgSlug}/team`);
  return { error: null };
}
