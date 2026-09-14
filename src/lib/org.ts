import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";

export type OrgRole = "admin" | "manager" | "cleaner" | "owner";

export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Administrateur",
  manager: "Gestionnaire",
  cleaner: "Femme de ménage",
  owner: "Propriétaire",
};

// Roles allowed to create/edit properties, units, and their photos —
// mirrors the RLS policies in 0004_properties_and_units.sql. Keeping this
// in one place means the "can I see the edit form" check in the UI and the
// "can this write actually happen" check in the database never drift apart.
export const CAN_MANAGE_PROPERTIES: OrgRole[] = ["admin", "manager"];

/**
 * Loads the organization for the given slug and the current user's role in
 * it. Throws notFound() if the org doesn't exist OR the user isn't a member
 * — RLS already hides organizations you don't belong to, so those two cases
 * are indistinguishable by design (no leaking "this org exists but you're
 * not in it" to a non-member).
 */
export async function requireOrgContext(slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  return { supabase, user, org, role: membership.role as OrgRole };
}

export function canManageProperties(role: OrgRole): boolean {
  return CAN_MANAGE_PROPERTIES.includes(role);
}
