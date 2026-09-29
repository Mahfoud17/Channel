import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireOrgContext, canManageProperties } from "@/lib/org";
import { UnitStatusBadge } from "@/components/unit-status-badge";
import { StatusSelector } from "./status-selector";
import { EditUnitForm } from "./edit-unit-form";
import { PhotoManager } from "./photo-manager";
import { DeleteUnitButton } from "./delete-unit-button";
import { AddChannelForm } from "./add-channel-form";
import { ChannelConnectionActions } from "./channel-connection-actions";
import { ExportUrlField } from "./export-url-field";
import { ChecklistEditor } from "./checklist-editor";

const CHANNEL_LABELS: Record<string, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  vrbo: "Vrbo / Abritel",
  other: "Autre",
};

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ slug: string; unitId: string }>;
}) {
  const { slug, unitId } = await params;
  const { supabase, org, role } = await requireOrgContext(slug);

  const { data: unit } = await supabase
    .from("units")
    .select(
      "id, name, property_id, bedrooms, beds, max_guests, status, has_elevator, has_parking, amenities, access_instructions, keybox_code, wifi_ssid, wifi_password, base_price, min_price, max_price, ical_export_token, properties(id, name)",
    )
    .eq("id", unitId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!unit) {
    notFound();
  }

  const property = Array.isArray(unit.properties) ? unit.properties[0] : unit.properties;

  const { data: photoRows } = await supabase
    .from("unit_photos")
    .select("id, storage_path")
    .eq("unit_id", unitId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  const photos = (photoRows ?? []).map((row) => ({
    id: row.id,
    storage_path: row.storage_path,
    url: supabase.storage.from("unit-photos").getPublicUrl(row.storage_path).data.publicUrl,
  }));

  const { data: channelConnections } = await supabase
    .from("channel_connections")
    .select("id, channel_type, ical_import_url, last_synced_at, last_sync_status, last_sync_message")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: true });

  const { data: checklist } = await supabase
    .from("cleaning_checklists")
    .select("items")
    .eq("unit_id", unitId)
    .maybeSingle();

  const requestHeaders = await headers();
  const origin = `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("host")}`;
  const exportUrl = `${origin}/api/v1/units/${unit.id}/ical.ics?token=${unit.ical_export_token}`;

  const canManage = canManageProperties(role);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        {property && (
          <Link
            href={`/org/${org.slug}/properties/${property.id}`}
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            ← {property.name}
          </Link>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-neutral-900">{unit.name}</h1>
            <UnitStatusBadge status={unit.status} />
          </div>
          <Link
            href={`/org/${org.slug}/pricing?unit=${unit.id}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Pricing →
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Statut opérationnel</h2>
          {canManage && (
            <StatusSelector
              unitId={unit.id}
              propertyId={unit.property_id}
              orgSlug={org.slug}
              currentStatus={unit.status}
            />
          )}
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Un logement en maintenance ou inactif n&apos;apparaît pas comme disponible dans le
          calendrier (Sprint&nbsp;3).
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Photos</h2>
        <div className="mt-4">
          <PhotoManager
            unitId={unit.id}
            orgId={org.id}
            orgSlug={org.slug}
            initialPhotos={photos}
          />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Détails</h2>
        <div className="mt-4">
          {canManage ? (
            <EditUnitForm
              unit={unit}
              unitId={unit.id}
              propertyId={unit.property_id}
              orgSlug={org.slug}
            />
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-neutral-500">Chambres</dt>
                <dd className="text-neutral-900">{unit.bedrooms}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Voyageurs max</dt>
                <dd className="text-neutral-900">{unit.max_guests}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      {canManage && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Checklist de ménage</h2>
          <div className="mt-4">
            <ChecklistEditor
              unitId={unit.id}
              orgSlug={org.slug}
              initialItems={
                checklist?.items ?? [
                  "Literie",
                  "Serviettes",
                  "Salle de bain",
                  "Cuisine",
                  "Sol",
                  "Poubelles",
                  "Produits",
                  "Wi-Fi",
                ]
              }
            />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Connexions plateformes</h2>
        <p className="mt-1 text-sm text-neutral-600">
          MVP en iCal uniquement — voir le dossier d&apos;architecture. Booking.com n&apos;accepte
          pas l&apos;import iCal : pour ce logement, ferme les dates manuellement sur Booking dès
          qu&apos;une réservation arrive d&apos;un autre canal.
        </p>

        <div className="mt-4 space-y-3">
          {(channelConnections ?? []).map((connection) => (
            <div
              key={connection.id}
              className="rounded-md border border-neutral-200 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-neutral-900">
                    {CHANNEL_LABELS[connection.channel_type] ?? connection.channel_type}
                  </span>
                  <SyncStatusBadge
                    status={connection.last_sync_status}
                    lastSyncedAt={connection.last_synced_at}
                  />
                </div>
                {canManage && (
                  <ChannelConnectionActions
                    connectionId={connection.id}
                    unitId={unit.id}
                    orgSlug={org.slug}
                  />
                )}
              </div>
              <p className="mt-1 truncate text-xs text-neutral-500">{connection.ical_import_url}</p>
              {connection.last_sync_status === "error" && connection.last_sync_message && (
                <p className="mt-1 text-xs text-critical">{connection.last_sync_message}</p>
              )}
            </div>
          ))}
          {(channelConnections ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">Aucune connexion pour l&apos;instant.</p>
          )}
        </div>

        {canManage && (
          <div className="mt-5 border-t border-neutral-100 pt-5">
            <h3 className="text-sm font-semibold text-neutral-900">Importer depuis une plateforme</h3>
            <div className="mt-3">
              <AddChannelForm unitId={unit.id} orgSlug={org.slug} />
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-neutral-100 pt-5">
          <h3 className="text-sm font-semibold text-neutral-900">
            URL d&apos;export à donner à Airbnb / Vrbo
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            À coller dans les paramètres de synchronisation de calendrier de la plateforme
            (côté OTA, pas ici) pour qu&apos;elle bloque ces dates chez elle.
          </p>
          <div className="mt-3">
            <ExportUrlField url={exportUrl} />
          </div>
        </div>
      </section>

      {canManage && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Zone dangereuse</h2>
          <div className="mt-3">
            <DeleteUnitButton
              unitId={unit.id}
              unitName={unit.name}
              propertyId={unit.property_id}
              orgSlug={org.slug}
            />
          </div>
        </section>
      )}
    </div>
  );
}

const SYNC_DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

function SyncStatusBadge({
  status,
  lastSyncedAt,
}: {
  status: string | null;
  lastSyncedAt: string | null;
}) {
  if (!lastSyncedAt) {
    return <span className="ml-2 text-xs text-neutral-400">Jamais synchronisé</span>;
  }

  const isOk = status === "ok";
  return (
    <span
      className={`ml-2 inline-flex items-center gap-1 text-xs ${
        isOk ? "text-good" : "text-critical"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isOk ? "bg-good" : "bg-critical"}`} />
      {isOk ? "OK" : "Erreur"} · {SYNC_DATE_FORMAT.format(new Date(lastSyncedAt))}
    </span>
  );
}
