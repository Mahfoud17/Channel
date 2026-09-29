import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgContext, canManageProperties } from "@/lib/org";
import { UnitStatusBadge } from "@/components/unit-status-badge";
import { CreateUnitForm } from "./create-unit-form";
import { EditPropertyForm } from "./edit-property-form";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ slug: string; propertyId: string }>;
}) {
  const { slug, propertyId } = await params;
  const { supabase, org, role } = await requireOrgContext(slug);

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, address_line1, address_line2, city, postal_code, country")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    notFound();
  }

  const { data: units } = await supabase
    .from("units")
    .select("id, name, unit_type, bedrooms, beds, max_guests, status")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const canManage = canManageProperties(role);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href={`/org/${org.slug}/properties`} className="text-sm text-ink-soft hover:text-ink">
          ← Logements
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-ink">{property.name}</h1>
        {!canManage && (
          <p className="text-sm text-ink-soft">
            {property.address_line1}
            {property.address_line2 ? `, ${property.address_line2}` : ""} — {property.city}{" "}
            {property.postal_code}, {property.country}
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Unités</h2>
        {units && units.length > 0 ? (
          <ul className="space-y-3">
            {units.map((unit) => (
              <li key={unit.id}>
                <Link
                  href={`/org/${org.slug}/units/${unit.id}`}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:border-accent"
                >
                  <div>
                    <p className="font-medium text-ink">{unit.name}</p>
                    <p className="text-sm text-ink-soft">
                      {unit.bedrooms} ch. · {unit.beds} lit{unit.beds > 1 ? "s" : ""} ·{" "}
                      {unit.max_guests} voyageurs max
                    </p>
                  </div>
                  <UnitStatusBadge status={unit.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Aucune unité pour l&apos;instant.</p>
        )}
      </section>

      {canManage && (
        <section className="card">
          <h2 className="text-base font-semibold text-ink">Ajouter une unité</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Une unité est ce qui se loue réellement — un appartement, une chambre. C&apos;est elle
            qui aura son propre calendrier, ses prix et ses ménages.
          </p>
          <div className="mt-4">
            <CreateUnitForm propertyId={property.id} orgSlug={org.slug} />
          </div>
        </section>
      )}

      {canManage && (
        <section className="card">
          <h2 className="text-base font-semibold text-ink">Détails du logement</h2>
          <div className="mt-4">
            <EditPropertyForm property={property} propertyId={property.id} orgSlug={org.slug} />
          </div>
        </section>
      )}
    </div>
  );
}
