import Link from "next/link";
import { requireOrgContext, canManageProperties } from "@/lib/org";
import { buildUnitRow, currentMonth, monthRange, shiftMonth, type CalendarEvent } from "@/lib/calendar";
import { CreateReservationForm } from "./create-reservation-form";
import { CreateBlockForm } from "./create-block-form";
import { DeleteBlockButton } from "./delete-block-button";

const REASON_LABELS: Record<string, string> = {
  maintenance: "Travaux",
  owner: "Propriétaire",
  other: "Bloqué",
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const DAY_FORMATTER = new Intl.DateTimeFormat("fr-FR", { day: "numeric" });

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { slug } = await params;
  const { month: monthParam } = await searchParams;
  const { supabase, org, role } = await requireOrgContext(slug);

  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : currentMonth();
  const { start: monthStart, end: monthEnd, daysInMonth } = monthRange(month);
  const canManage = canManageProperties(role);

  const { data: units } = await supabase
    .from("units")
    .select("id, name, property_id, properties(name)")
    .is("deleted_at", null);

  type RawUnit = {
    id: string;
    name: string;
    properties: { name: string } | { name: string }[] | null;
  };

  const sortedUnits = ((units ?? []) as RawUnit[])
    .map((u) => ({
      id: u.id,
      name: u.name,
      propertyName: Array.isArray(u.properties) ? u.properties[0]?.name : u.properties?.name,
    }))
    .sort((a, b) =>
      `${a.propertyName ?? ""} ${a.name}`.localeCompare(`${b.propertyName ?? ""} ${b.name}`),
    );

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, unit_id, guest_first_name, guest_last_name, check_in, check_out, status")
    .neq("status", "cancelled")
    .lt("check_in", monthEnd)
    .gt("check_out", monthStart);

  const { data: blocks } = await supabase
    .from("calendar_blocks")
    .select("id, unit_id, start_date, end_date, reason")
    .lt("start_date", monthEnd)
    .gt("end_date", monthStart);

  const eventsByUnit = new Map<string, CalendarEvent[]>();
  for (const r of reservations ?? []) {
    const list = eventsByUnit.get(r.unit_id) ?? [];
    list.push({
      id: r.id,
      type: "reservation",
      startDate: r.check_in,
      endDate: r.check_out,
      label: `${r.guest_first_name} ${r.guest_last_name}`,
      href: `/org/${org.slug}/reservations/${r.id}`,
    });
    eventsByUnit.set(r.unit_id, list);
  }
  for (const b of blocks ?? []) {
    const list = eventsByUnit.get(b.unit_id) ?? [];
    list.push({
      id: b.id,
      type: "block",
      startDate: b.start_date,
      endDate: b.end_date,
      label: REASON_LABELS[b.reason] ?? b.reason,
    });
    eventsByUnit.set(b.unit_id, list);
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(`${monthStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });

  const activeBlocksThisMonth = (blocks ?? []).map((b) => ({
    ...b,
    unitName: sortedUnits.find((u) => u.id === b.unit_id)?.name ?? "—",
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold capitalize text-neutral-900">
          {MONTH_FORMATTER.format(new Date(`${monthStart}T00:00:00Z`))}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/org/${org.slug}/calendar?month=${shiftMonth(month, -1)}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            ← Précédent
          </Link>
          <Link
            href={`/org/${org.slug}/calendar?month=${currentMonth()}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Aujourd&apos;hui
          </Link>
          <Link
            href={`/org/${org.slug}/calendar?month=${shiftMonth(month, 1)}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Suivant →
          </Link>
        </div>
      </div>

      <div className="flex gap-4 text-xs text-neutral-600">
        <LegendSwatch color="bg-white border border-neutral-300" label="Disponible" />
        <LegendSwatch color="bg-good" label="Réservé" />
        <LegendSwatch color="bg-warn-soft0" label="Bloqué" />
      </div>

      {sortedUnits.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Aucune unité pour l&apos;instant —{" "}
          <Link href={`/org/${org.slug}/properties`} className="text-accent underline">
            ajoute un logement
          </Link>{" "}
          pour voir le calendrier.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[160px] border-b border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-600">
                  Logement
                </th>
                {days.map((d) => (
                  <th
                    key={d.toISOString()}
                    className="min-w-[32px] border-b border-neutral-200 bg-neutral-50 px-1 py-2 text-center font-medium text-neutral-500"
                  >
                    {DAY_FORMATTER.format(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedUnits.map((unit) => {
                const cells = buildUnitRow(monthStart, monthEnd, eventsByUnit.get(unit.id) ?? []);
                return (
                  <tr key={unit.id}>
                    <td className="sticky left-0 z-10 border-b border-r border-neutral-200 bg-white px-3 py-2 font-medium text-neutral-900">
                      <Link
                        href={`/org/${org.slug}/units/${unit.id}`}
                        className="hover:text-accent"
                      >
                        {unit.name}
                      </Link>
                      {unit.propertyName && (
                        <p className="text-[11px] font-normal text-neutral-400">
                          {unit.propertyName}
                        </p>
                      )}
                    </td>
                    {cells.map((cell) =>
                      cell.kind === "available" ? (
                        <td key={cell.date} className="border-b border-neutral-100 bg-white" />
                      ) : (
                        <td
                          key={cell.event.id}
                          colSpan={cell.nights}
                          className="border-b border-neutral-100 p-0.5"
                        >
                          {cell.event.href ? (
                            <Link
                              href={cell.event.href}
                              title={cell.event.label}
                              className="block truncate rounded bg-good px-1.5 py-1 text-center text-white hover:opacity-90"
                            >
                              {cell.event.label}
                            </Link>
                          ) : (
                            <span
                              title={cell.event.label}
                              className="block truncate rounded bg-warn-soft0 px-1.5 py-1 text-center text-white"
                            >
                              {cell.event.label}
                            </span>
                          )}
                        </td>
                      ),
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage && sortedUnits.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-neutral-900">Créer une réservation</h2>
            <div className="mt-4">
              <CreateReservationForm units={sortedUnits} orgSlug={org.slug} />
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-neutral-900">Bloquer des dates</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Travaux, usage personnel — le logement n&apos;apparaît plus disponible sans créer de
              réservation.
            </p>
            <div className="mt-4">
              <CreateBlockForm units={sortedUnits} orgSlug={org.slug} />
            </div>
          </section>
        </div>
      )}

      {canManage && activeBlocksThisMonth.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Blocages ce mois-ci</h2>
          <ul className="mt-3 space-y-2">
            {activeBlocksThisMonth.map((block) => (
              <li
                key={block.id}
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                <span>
                  <strong className="text-neutral-900">{block.unitName}</strong> —{" "}
                  {REASON_LABELS[block.reason] ?? block.reason} du {block.start_date} au{" "}
                  {block.end_date}
                </span>
                <DeleteBlockButton blockId={block.id} orgSlug={org.slug} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${color}`} />
      {label}
    </span>
  );
}
