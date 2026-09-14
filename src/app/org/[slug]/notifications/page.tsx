import Link from "next/link";
import { requireOrgContext } from "@/lib/org";
import { MarkReadButton } from "./mark-read-button";
import { MarkAllReadButton } from "./mark-all-read-button";

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

function relativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 60) return RELATIVE_FORMAT.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return RELATIVE_FORMAT.format(diffHour, "hour");
  return RELATIVE_FORMAT.format(Math.round(diffHour / 24), "day");
}

export default async function NotificationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, org } = await requireOrgContext(slug);

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Notifications</h1>
        {unreadCount > 0 && <MarkAllReadButton orgSlug={org.slug} />}
      </div>

      {(!notifications || notifications.length === 0) && (
        <p className="text-sm text-neutral-500">Rien pour l&apos;instant.</p>
      )}

      <ul className="space-y-2">
        {(notifications ?? []).map((n) => (
          <li
            key={n.id}
            className={`flex items-start justify-between gap-3 rounded-xl border p-4 shadow-sm ${
              n.read_at ? "border-neutral-200 bg-white" : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />}
                {n.link ? (
                  <Link
                    href={`/org/${org.slug}${n.link}`}
                    className="font-medium text-neutral-900 hover:text-emerald-700"
                  >
                    {n.title}
                  </Link>
                ) : (
                  <span className="font-medium text-neutral-900">{n.title}</span>
                )}
              </div>
              {n.body && <p className="mt-1 text-sm text-neutral-600">{n.body}</p>}
              <p className="mt-1 text-xs text-neutral-400">{relativeTime(n.created_at)}</p>
            </div>
            {!n.read_at && <MarkReadButton notificationId={n.id} orgSlug={org.slug} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
