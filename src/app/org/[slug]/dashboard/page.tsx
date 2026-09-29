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
    {
      label: "Problèmes signalés",
      value: problemsCount ?? 0,
      tone: (problemsCount ?? 0) > 0 ? ("critical" as const) : ("default" as const),
    },
    {
      label: "Ménages non attribués",
      value: unassignedCount ?? 0,
      tone: (unassignedCount ?? 0) > 0 ? ("warning" as const) : ("default" as const),
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl capitalize text-ink">
        {DATE_FORMAT.format(new Date(`${todayDate}T00:00:00Z`))}
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`rounded-xl border p-4 ${
              tile.tone === "critical"
                ? "border-critical/30 bg-critical-soft"
                : tile.tone === "warning"
                  ? "border-warn/30 bg-warn-soft"
                  : "border-line bg-surface"
            }`}
          >
            <p
              className={`font-display text-4xl font-semibold tabular-nums ${
                tile.tone === "critical" ? "text-critical" : tile.tone === "warning" ? "text-warn" : "text-ink"
              }`}
            >
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-ink-soft">{tile.label}</p>
          </div>
        ))}
      </div>

      {((problemsCount ?? 0) > 0 || (unassignedCount ?? 0) > 0) && (
        <div className="space-y-2">
          {(problemsCount ?? 0) > 0 && (
            <Link
              href={`/org/${org.slug}/cleaning`}
              className="block rounded-lg border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical hover:border-critical/40"
            >
              {problemsCount} ménage{(problemsCount ?? 0) > 1 ? "s" : ""} avec un problème signalé — à
              traiter.
            </Link>
          )}
          {(unassignedCount ?? 0) > 0 && (
            <Link
              href={`/org/${org.slug}/cleaning`}
              className="block rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn hover:border-warn/40"
            >
              {unassignedCount} ménage{(unassignedCount ?? 0) > 1 ? "s" : ""} pas encore attribué
              {(unassignedCount ?? 0) > 1 ? "s" : ""}.
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-base font-semibold text-ink">Arrivées du jour</h2>
          {arrivals && arrivals.length > 0 ? (
            <ul className="mt-3 divide-y divide-line-soft text-sm">
              {arrivals.map((r) => (
                <li key={r.id} className="flex justify-between py-2 first:pt-0 last:pb-0">
                  <span className="text-ink">
                    {r.guest_first_name} {r.guest_last_name}
                  </span>
                  <span className="text-ink-soft">{unitName(r)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Aucune arrivée aujourd&apos;hui.</p>
          )}
        </section>

        <section className="card">
          <h2 className="text-base font-semibold text-ink">Départs du jour</h2>
          {departures && departures.length > 0 ? (
            <ul className="mt-3 divide-y divide-line-soft text-sm">
              {departures.map((r) => (
                <li key={r.id} className="flex justify-between py-2 first:pt-0 last:pb-0">
                  <span className="text-ink">
                    {r.guest_first_name} {r.guest_last_name}
                  </span>
                  <span className="text-ink-soft">{unitName(r)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Aucun départ aujourd&apos;hui.</p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Dernières notifications</h2>
          <Link href={`/org/${org.slug}/notifications`} className="text-sm text-accent hover:underline">
            Tout voir
          </Link>
        </div>
        {recentNotifications && recentNotifications.length > 0 ? (
          <ul className="mt-3 divide-y divide-line-soft text-sm">
            {recentNotifications.map((n) => (
              <li key={n.id} className="py-2 first:pt-0 last:pb-0">
                {n.link ? (
                  <Link href={`/org/${org.slug}${n.link}`} className="text-ink hover:text-accent">
                    {n.title}
                  </Link>
                ) : (
                  <span className="text-ink">{n.title}</span>
                )}
                {n.body && <span className="text-ink-soft"> — {n.body}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">Aucune notification non lue.</p>
        )}
      </section>
    </div>
  );
}
