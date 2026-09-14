import { requireOrgContext, ROLE_LABELS, type OrgRole } from "@/lib/org";
import { AddMemberForm } from "./add-member-form";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, org, role } = await requireOrgContext(slug);

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("user_id, role, status")
    .order("created_at", { ascending: true });

  const memberIds = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", memberIds.length > 0 ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const isAdmin = role === "admin";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold text-neutral-900">Équipe</h1>

      <ul className="space-y-2">
        {(memberships ?? []).map((membership) => {
          const profile = profileById.get(membership.user_id);
          return (
            <li
              key={membership.user_id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-neutral-900">
                  {profile?.full_name || profile?.email || membership.user_id}
                </p>
                {profile?.full_name && <p className="text-sm text-neutral-500">{profile.email}</p>}
              </div>
              <span className="text-sm text-neutral-600">
                {ROLE_LABELS[membership.role as OrgRole] ?? membership.role}
              </span>
            </li>
          );
        })}
      </ul>

      {isAdmin ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Ajouter un membre</h2>
          <p className="mt-1 text-sm text-neutral-600">
            La personne doit avoir déjà créé un compte (page de connexion) avant de pouvoir être
            ajoutée ici — il n&apos;y a pas encore d&apos;invitation par email.
          </p>
          <div className="mt-4">
            <AddMemberForm orgId={org.id} orgSlug={org.slug} />
          </div>
        </section>
      ) : (
        <p className="text-sm text-neutral-500">
          Seul un administrateur peut ajouter des membres à l&apos;organisation.
        </p>
      )}
    </div>
  );
}
