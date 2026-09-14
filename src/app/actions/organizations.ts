"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "organisation"
  );
}

export type CreateOrganizationState = { error: string | null };

/**
 * Creates the organization and, via the `on_organization_created` trigger
 * (see supabase/migrations/0002_organizations_and_roles.sql), makes the
 * calling user its admin — in one round trip, with no window where an
 * organization exists without an owner.
 */
export async function createOrganization(
  _prevState: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Le nom est obligatoire." };
  }

  const supabase = await createClient();
  const baseSlug = slugify(name);
  // Append a short suffix so two organizations named the same way don't
  // collide on the unique slug constraint.
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { error } = await supabase.from("organizations").insert({ name, slug });

  if (error) {
    return { error: "Impossible de créer l'organisation. Réessaie." };
  }

  revalidatePath("/");
  return { error: null };
}
