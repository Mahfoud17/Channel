import Link from "next/link";
import { requireOrgContext, canManageProperties } from "@/lib/org";
import { CreatePropertyForm } from "./create-property-form";

export default async function PropertiesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supabase, org, role } = await requireOrgContext(slug);

  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, city, postal_code, units(id, status)")
    .is("deleted_at", null)
    .is("units.deleted_at", null)
    .order("created_at", { ascending: false });

  const canManage = canManageProperties(role);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Logements</h1>
      </div>

      {properties && properties.length > 0 ? (
        <ul className="space-y-3">
          {properties.map((property) => {
            const units = property.units ?? [];
            const activeCount = units.filter((u) => u.status === "active").length;
            return (
              <li key={property.id}>
                <Link
                  href={`/org/${org.slug}/properties/${property.id}`}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-emerald-600"
                >
                  <div>
                    <p className="font-medium text-neutral-900">{property.name}</p>
                    <p className="text-sm text-neutral-500">
                      {property.city} {property.postal_code}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-500">
                    {units.length} unité{units.length > 1 ? "s" : ""}
                    {units.length > 0 && ` · ${activeCount} active${activeCount > 1 ? "s" : ""}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500">Aucun logement pour l&apos;instant.</p>
      )}

      {canManage && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Ajouter un logement</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Un logement est l&apos;adresse physique — tu ajoutes les unités louables (appartements,
            chambres…) une fois le logement créé.
          </p>
          <div className="mt-4">
            <CreatePropertyForm orgId={org.id} orgSlug={org.slug} />
          </div>
        </section>
      )}
    </div>
  );
}
