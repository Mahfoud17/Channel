import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgContext, canManageProperties } from "@/lib/org";
import { ReservationStatusBadge } from "@/components/reservation-status-badge";
import { daysBetween } from "@/lib/calendar";
import { CancelReservationButton } from "./cancel-reservation-button";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ slug: string; reservationId: string }>;
}) {
  const { slug, reservationId } = await params;
  const { supabase, org, role } = await requireOrgContext(slug);

  const { data: reservation } = await supabase
    .from("reservations")
    .select(
      "id, unit_id, guest_first_name, guest_last_name, guest_email, guest_phone, num_guests, check_in, check_out, nightly_price, cleaning_fee, extra_fees, discount, status, source, notes, created_at, units(name, property_id, properties(name))",
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation) {
    notFound();
  }

  const unit = Array.isArray(reservation.units) ? reservation.units[0] : reservation.units;
  const property = unit ? (Array.isArray(unit.properties) ? unit.properties[0] : unit.properties) : null;

  const nights = daysBetween(reservation.check_in, reservation.check_out);
  const total =
    nights * Number(reservation.nightly_price) +
    Number(reservation.cleaning_fee) +
    Number(reservation.extra_fees) -
    Number(reservation.discount);

  const canManage = canManageProperties(role);
  const canCancel = canManage && !["cancelled", "completed"].includes(reservation.status);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/org/${org.slug}/calendar`}
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← Calendrier
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-900">
            {reservation.guest_first_name} {reservation.guest_last_name}
          </h1>
          <ReservationStatusBadge status={reservation.status} />
        </div>
        {unit && (
          <p className="text-sm text-neutral-600">
            {unit.name}
            {property?.name ? ` — ${property.name}` : ""}
          </p>
        )}
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Item label="Arrivée" value={DATE_FORMAT.format(new Date(`${reservation.check_in}T00:00:00Z`))} />
          <Item label="Départ" value={DATE_FORMAT.format(new Date(`${reservation.check_out}T00:00:00Z`))} />
          <Item label="Nuits" value={String(nights)} />
          <Item label="Voyageurs" value={String(reservation.num_guests)} />
          <Item label="Email" value={reservation.guest_email || "—"} />
          <Item label="Téléphone" value={reservation.guest_phone || "—"} />
          <Item label="Source" value={reservation.source === "direct" ? "Manuelle" : reservation.source} />
          <Item label="Créée le" value={DATE_FORMAT.format(new Date(reservation.created_at))} />
        </dl>
        {reservation.notes && (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Notes</p>
            <p className="mt-1 text-sm text-neutral-700">{reservation.notes}</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Détail financier</h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row label={`Prix / nuit × ${nights}`} value={EUR.format(nights * Number(reservation.nightly_price))} />
          <Row label="Frais de ménage" value={EUR.format(Number(reservation.cleaning_fee))} />
          {Number(reservation.extra_fees) > 0 && (
            <Row label="Frais supplémentaires" value={EUR.format(Number(reservation.extra_fees))} />
          )}
          {Number(reservation.discount) > 0 && (
            <Row label="Réduction" value={`− ${EUR.format(Number(reservation.discount))}`} />
          )}
          <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-medium text-neutral-900">
            <span>Total</span>
            <span>{EUR.format(total)}</span>
          </div>
        </dl>
      </section>

      {canCancel && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Zone dangereuse</h2>
          <div className="mt-3">
            <CancelReservationButton reservationId={reservation.id} orgSlug={org.slug} />
          </div>
        </section>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-neutral-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
