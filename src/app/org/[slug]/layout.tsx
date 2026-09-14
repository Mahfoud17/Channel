import Link from "next/link";
import { requireOrgContext, ROLE_LABELS } from "@/lib/org";
import { signOut } from "@/app/actions/auth";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supabase, org, role } = await requireOrgContext(slug);

  const { count: unreadCount } =
    role === "cleaner"
      ? { count: 0 }
      : await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Link
              href="/"
              className="text-xs font-medium uppercase tracking-wide text-emerald-700 hover:text-emerald-800"
            >
              Channel Manager
            </Link>
            <p className="text-sm font-medium text-neutral-900">{org.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-500">{ROLE_LABELS[role]}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 px-6">
          {role !== "cleaner" && (
            <>
              <Link
                href={`/org/${slug}/dashboard`}
                className="rounded-t-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Tableau de bord
              </Link>
              <Link
                href={`/org/${slug}/calendar`}
                className="rounded-t-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Calendrier
              </Link>
              <Link
                href={`/org/${slug}/properties`}
                className="rounded-t-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Logements
              </Link>
              <Link
                href={`/org/${slug}/pricing`}
                className="rounded-t-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Pricing
              </Link>
              <Link
                href={`/org/${slug}/messages`}
                className="rounded-t-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Messages
              </Link>
            </>
          )}
          <Link
            href={`/org/${slug}/cleaning`}
            className="rounded-t-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Ménage
          </Link>
          {role !== "cleaner" && (
            <>
              <Link
                href={`/org/${slug}/team`}
                className="rounded-t-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Équipe
              </Link>
              <Link
                href={`/org/${slug}/notifications`}
                className="flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Notifications
                {!!unreadCount && unreadCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href={`/org/${slug}/audit`}
                className="rounded-t-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Historique
              </Link>
            </>
          )}
        </nav>
      </header>

      <div className="flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
