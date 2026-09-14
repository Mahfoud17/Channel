import { requireOrgContext } from "@/lib/org";
import { CleaningStatusBadge } from "@/components/cleaning-status-badge";
import { CleanerTaskCard, type CleanerTask } from "./cleaner-task-card";
import { AssignCleanerSelect } from "./assign-cleaner-select";

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

export default async function CleaningPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user, org, role } = await requireOrgContext(slug);

  if (role === "cleaner") {
    const { data: tasks } = await supabase
      .from("cleaning_tasks")
      .select(
        "id, scheduled_date, status, unit_id, units(name, properties(name)), reservations(guest_first_name, guest_last_name)",
      )
      .eq("assigned_to", user.id)
      .neq("status", "cancelled")
      .order("scheduled_date", { ascending: true });

    const relevantUnitIds = [...new Set((tasks ?? []).map((t) => t.unit_id))];
    const { data: checklists } = await supabase
      .from("cleaning_checklists")
      .select("unit_id, items")
      .in("unit_id", relevantUnitIds.length > 0 ? relevantUnitIds : ["00000000-0000-0000-0000-000000000000"]);
    const checklistByUnit = new Map((checklists ?? []).map((c) => [c.unit_id, c.items as string[]]));

    const cleanerTasks: CleanerTask[] = (tasks ?? []).map((t) => {
      const unit = Array.isArray(t.units) ? t.units[0] : t.units;
      const property = unit
        ? Array.isArray(unit.properties)
          ? unit.properties[0]
          : unit.properties
        : null;
      const reservation = Array.isArray(t.reservations) ? t.reservations[0] : t.reservations;
      return {
        id: t.id,
        scheduled_date: t.scheduled_date,
        status: t.status,
        unitName: unit?.name ?? "—",
        propertyName: property?.name ?? null,
        departingGuestLabel: reservation
          ? `${reservation.guest_first_name} ${reservation.guest_last_name}`
          : null,
        checklistItems:
          checklistByUnit.get(t.unit_id) ?? [
            "Literie",
            "Serviettes",
            "Salle de bain",
            "Cuisine",
            "Sol",
            "Poubelles",
          ],
      };
    });

    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-semibold text-neutral-900">Mes ménages</h1>
        {cleanerTasks.length === 0 ? (
          <p className="text-sm text-neutral-500">Aucune mission pour l&apos;instant.</p>
        ) : (
          cleanerTasks.map((task) => (
            <CleanerTaskCard key={task.id} task={task} orgId={org.id} orgSlug={org.slug} />
          ))
        )}
      </div>
    );
  }

  // Admin / manager — full planning across the organization.
  const { data: tasks } = await supabase
    .from("cleaning_tasks")
    .select(
      "id, scheduled_date, status, assigned_to, units(name, properties(name)), reservations(guest_first_name, guest_last_name)",
    )
    .neq("status", "cancelled")
    .order("scheduled_date", { ascending: true });

  const { data: cleanerMemberships } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("role", "cleaner")
    .eq("status", "active");

  const cleanerIds = (cleanerMemberships ?? []).map((m) => m.user_id);
  const { data: cleanerProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", cleanerIds.length > 0 ? cleanerIds : ["00000000-0000-0000-0000-000000000000"]);

  const cleanerOptions = (cleanerProfiles ?? []).map((p) => ({
    id: p.id,
    label: p.full_name || p.email,
  }));
  const cleanerLabelById = new Map(cleanerOptions.map((c) => [c.id, c.label]));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Planning ménage</h1>

      {(!tasks || tasks.length === 0) && (
        <p className="text-sm text-neutral-500">
          Aucune tâche pour l&apos;instant — elles se créent automatiquement au départ de chaque
          voyageur.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Logement</th>
              <th className="px-4 py-2">Voyageur parti</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Attribué à</th>
            </tr>
          </thead>
          <tbody>
            {(tasks ?? []).map((task) => {
              const unit = Array.isArray(task.units) ? task.units[0] : task.units;
              const property = unit
                ? Array.isArray(unit.properties)
                  ? unit.properties[0]
                  : unit.properties
                : null;
              const reservation = Array.isArray(task.reservations)
                ? task.reservations[0]
                : task.reservations;
              return (
                <tr key={task.id} className="border-b border-neutral-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-600">
                    {DATE_FORMAT.format(new Date(`${task.scheduled_date}T00:00:00Z`))}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium text-neutral-900">{unit?.name ?? "—"}</span>
                    {property?.name && <span className="text-neutral-400"> · {property.name}</span>}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">
                    {reservation ? `${reservation.guest_first_name} ${reservation.guest_last_name}` : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <CleaningStatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-2">
                    {cleanerOptions.length === 0 ? (
                      <span className="text-xs text-neutral-400">Aucune femme de ménage</span>
                    ) : (
                      <AssignCleanerSelect
                        taskId={task.id}
                        orgSlug={org.slug}
                        currentAssignee={task.assigned_to}
                        cleaners={cleanerOptions}
                      />
                    )}
                    {task.assigned_to && !cleanerLabelById.has(task.assigned_to) && (
                      <span className="ml-1 text-xs text-neutral-400">(compte non-ménage)</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cleanerOptions.length === 0 && (
        <p className="text-sm text-neutral-500">
          Aucun membre avec le rôle « Femme de ménage » pour l&apos;instant — invite quelqu&apos;un
          avec ce rôle pour pouvoir attribuer des tâches.
        </p>
      )}
    </div>
  );
}
