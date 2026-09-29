"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  badge?: number;
};

export function OrgNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-4 sm:px-6">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "text-accent" : "text-ink-soft hover:text-ink"
            }`}
          >
            {item.label}
            {!!item.badge && item.badge > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-ink">
                {item.badge}
              </span>
            )}
            {isActive && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
          </Link>
        );
      })}
    </nav>
  );
}
