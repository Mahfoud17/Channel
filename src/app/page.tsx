import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { CreateOrganizationForm } from "@/app/create-organization-form";
import { ROLE_LABELS, type OrgRole } from "@/lib/org";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .eq("user_id", user.id);

  return (
    <main className="flex min-h-full flex-1 flex-col bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            Channel Manager
          </p>
          <p className="text-sm text-neutral-600">{user.email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Se déconnecter
          </button>
        </form>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        {!memberships || memberships.length === 0 ? (
          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-neutral-900">
              Créer ta première organisation
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Une organisation regroupe tes logements, ton équipe et tes réservations. Tu en
              deviens automatiquement administrateur.
            </p>
            <div className="mt-6">
              <CreateOrganizationForm />
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <h1 className="text-xl font-semibold text-neutral-900">Tes organisations</h1>
            <ul className="space-y-3">
              {memberships.map((membership) => {
                const org = Array.isArray(membership.organizations)
                  ? membership.organizations[0]
                  : membership.organizations;
                if (!org) return null;
                return (
                  <li key={org.id}>
                    <Link
                      href={`/org/${org.slug}`}
                      className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-accent"
                    >
                      <div>
                        <p className="font-medium text-neutral-900">{org.name}</p>
                        <p className="text-sm text-neutral-500">
                          {ROLE_LABELS[membership.role as OrgRole] ?? membership.role}
                        </p>
                      </div>
                      <span aria-hidden className="text-neutral-400">
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
