"use client";

import { useTransition } from "react";
import { markAllNotificationsRead } from "@/app/actions/notifications";

export function MarkAllReadButton({ orgSlug }: { orgSlug: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsRead(orgSlug);
        })
      }
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
    >
      {isPending ? "…" : "Tout marquer comme lu"}
    </button>
  );
}
