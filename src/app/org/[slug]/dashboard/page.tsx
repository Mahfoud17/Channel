import Link from "next/link";
import { requireOrgContext } from "@/lib/org";

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, org } = await requireOrgContext(slug);
  const todayDate = today();

  const [
    { data: arrivals },
    { data: departures },
    { data: cleaningsToday },
    { count: problemsCount },
    { count: unassignedCount },
    { data: recentNotifications },
  ] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, guest_first_name, guest_last_name, units(name)")
      .eq("check_in", todayDate)
      .neq("status", "cancelled"),
    supabase
      .from("reservations")
      .select("id, guest_first_name, guest_last_name, units(name)")
      .eq("check_out", todayDate)
      .neq("status", "cancelled"),
    supabase
      .from("cleaning_tasks")
      .select("id, status, units(name)")
      .eq("scheduled_date", todayDate)
      .neq("status", "cancelled"),
    supabase.from("cleaning_tasks").select("id", { count: "exact", head: true }).eq("status", "problem"),
    supabase
      .from("cleaning_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "unassigned")
      .gte("scheduled_date", todayDate),
    supabase
      .from("notifications")
      .select("id, title, body, link, created_at")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const unitName = (row: { units: { name: string } | { name: string }[] | null }) => {
    const u = Array.isArray(row.units) ? row.units[0] : row.units;
    return u?.name ?? "—";
  };

  const tiles = [
    { label: "Arrivées aujourd'hui", value: arrivals?.length ?? 0, tone: "default" as const },
    { label: "Départs aujourd'hui", value: departures?.length ?? 0, tone: "default" as const },
    { label: "Ménages aujourd'hui", value: cleaningsToday?.length ?? 0, tone: "default" as const },
    { label: "Problèmes signalés", value: problemsCount ?? 0, tone: (problemsCount ?? 0) > 0 ? "critical" as const : "default" as const },
    { label: "Ménages non attribués", value: unassignedCount ?? 0, tone: (unassignedCount ?? 0) > 0 ? "warning" as const : "default" as const },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold capitalize text-neutral-900">
          {DATE_FORMAT.format(new Date(`${todayDate}T00:00:00Z`))}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`rounded-xl border p-4 shadow-sm ${
              tile.tone === "critical"
                ? "border-red-200 bg-red-50"
                : tile.tone === "warning"
                  ? "border-amber-200 bg-amber-50"
                  : "border-neutral-200 bg-white"
            }`}
          >
            <p
              className={`text-2xl font-semibold tabular-nums ${
                tile.tone === "critical"
                  ? "text-red-700"
                  : tile.tone === "warning"
                    ? "text-amber-700"
                    : "text-neutral-900"
              }`}
            >
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-neutral-500">{tile.label}</p>
          </div>
        ))}
      </div>

      {((problemsCount ?? 0) > 0 || (unassignedCount ?? 0) > 0) && (
        <div className="space-y-2">
          {(problemsCount ?? 0) > 0 && (
            <Link
              href={`/org/${org.slug}/cleaning`}
              className="block rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 hover:border-red-300"
            >
              ⚠ {problemsCount} ménage(s) avec un problème signalé — à traiter.
            </Link>
          )}
          {(unassignedCount ?? 0) > 0 && (
            <Link
              href={`/org/${org.slug}/cleaning`}
              className="block rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:border-amber-300"
            >
              ⚠ {unassignedCount} ménage(s) pas encore attribué(s).
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Arrivées du jour</h2>
          {arrivals && arrivals.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {arrivals.map((r) => (
                <li key={r.id} className="flex justify-between">
                  <span className="text-neutral-900">
                    {r.guest_first_name} {r.guest_last_name}
                  </span>
                  <span className="text-neutral-500">{unitName(r)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Aucune arrivée aujourd&apos;hui.</p>
          )}
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Départs du jour</h2>
          {departures && departures.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {departures.map((r) => (
                <li key={r.id} className="flex justify-between">
                  <span className="text-neutral-900">
                    {r.guest_first_name} {r.guest_last_name}
                  </span>
                  <span className="text-neutral-500">{unitName(r)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Aucun départ aujourd&apos;hui.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Dernières notifications</h2>
          <Link href={`/org/${org.slug}/notifications`} className="text-sm text-emerald-700 hover:underline">
            Tout voir
          </Link>
        </div>
        {recentNotifications && recentNotifications.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {recentNotifications.map((n) => (
              <li key={n.id}>
                {n.link ? (
                  <Link href={`/org/${org.slug}${n.link}`} className="text-neutral-900 hover:text-emerald-700">
                    {n.title}
                  </Link>
                ) : (
                  <span className="text-neutral-900">{n.title}</span>
                )}
                {n.body && <span className="text-neutral-500"> — {n.body}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">Aucune notification non lue.</p>
        )}
      </section>
    </div>
  );
}
