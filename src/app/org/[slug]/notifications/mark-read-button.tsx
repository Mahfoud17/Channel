"use client";

import { useTransition } from "react";
import { markNotificationRead } from "@/app/actions/notifications";

export function MarkReadButton({ notificationId, orgSlug }: { notificationId: string; orgSlug: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationRead(notificationId, orgSlug);
        })
      }
      className="shrink-0 text-xs text-neutral-500 hover:text-emerald-700 disabled:opacity-60"
    >
      {isPending ? "…" : "Marquer comme lu"}
    </button>
  );
}
