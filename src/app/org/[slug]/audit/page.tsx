import { requireOrgContext } from "@/lib/org";

const ENTITY_LABELS: Record<string, string> = {
  reservations: "Réservation",
  units: "Logement",
  cleaning_tasks: "Ménage",
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
};

const IGNORED_FIELDS = new Set([
  "id",
  "organization_id",
  "unit_id",
  "created_at",
  "updated_at",
  "stay_range",
  "block_range",
]);

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

type JsonRecord = Record<string, unknown>;

function diffFields(before: JsonRecord | null, after: JsonRecord | null) {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.push({ field: key, from: before[key], to: after[key] });
    }
  }
  return changes;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "oui" : "non";
  return String(value);
}

export default async function AuditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase } = await requireOrgContext(slug);

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, before, after, source, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const userIds = [...new Set((logs ?? []).map((l) => l.user_id).filter(Boolean))] as string[];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Historique</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Les 100 dernières opérations sur les réservations, logements et ménages.
        </p>
      </div>

      {(!logs || logs.length === 0) && (
        <p className="text-sm text-neutral-500">Aucune opération enregistrée pour l&apos;instant.</p>
      )}

      <ul className="space-y-2">
        {(logs ?? []).map((log) => {
          const actor = log.user_id ? profileById.get(log.user_id) : null;
          const changes = log.action === "UPDATE" ? diffFields(log.before, log.after) : [];
          return (
            <li key={log.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium text-neutral-900">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>{" "}
                  <span className="text-neutral-600">
                    — {ENTITY_LABELS[log.entity_type] ?? log.entity_type}
                  </span>
                </span>
                <span className="text-xs text-neutral-400">{DATE_FORMAT.format(new Date(log.created_at))}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {actor?.full_name || actor?.email || (log.source === "system" ? "Système (sync automatique)" : "Utilisateur supprimé")}
              </p>
              {changes.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-600">
                  {changes.map((change) => (
                    <li key={change.field}>
                      <span className="font-mono text-neutral-500">{change.field}</span>{" "}
                      {formatValue(change.from)} → <span className="font-medium text-neutral-900">{formatValue(change.to)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
