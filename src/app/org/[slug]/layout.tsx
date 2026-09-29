import Link from "next/link";
import { requireOrgContext, ROLE_LABELS } from "@/lib/org";
import { signOut } from "@/app/actions/auth";
import { OrgNav, type NavItem } from "./org-nav";

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

  const base = `/org/${slug}`;
  const navItems: NavItem[] =
    role === "cleaner"
      ? [{ href: `${base}/cleaning`, label: "Ménage" }]
      : [
          { href: `${base}/dashboard`, label: "Tableau de bord" },
          { href: `${base}/calendar`, label: "Calendrier" },
          { href: `${base}/properties`, label: "Logements" },
          { href: `${base}/pricing`, label: "Pricing" },
          { href: `${base}/messages`, label: "Messages" },
          { href: `${base}/cleaning`, label: "Ménage" },
          { href: `${base}/team`, label: "Équipe" },
          { href: `${base}/notifications`, label: "Notifications", badge: unreadCount ?? 0 },
          { href: `${base}/audit`, label: "Historique" },
        ];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent font-display text-base font-semibold text-accent-ink">
              C
            </span>
            <span>
              <span className="block font-display text-base font-semibold italic leading-tight text-ink">
                Channel Manager
              </span>
              <span className="block text-xs leading-tight text-ink-soft">{org.name}</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-soft sm:inline-block">
              {ROLE_LABELS[role]}
            </span>
            <form action={signOut}>
              <button type="submit" className="btn btn-secondary">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
        <OrgNav items={navItems} />
      </header>

      <div className="flex-1 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
