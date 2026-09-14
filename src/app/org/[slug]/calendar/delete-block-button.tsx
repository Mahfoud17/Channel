"use client";

import { useTransition } from "react";
import { deleteCalendarBlock } from "@/app/actions/calendar-blocks";

export function DeleteBlockButton({ blockId, orgSlug }: { blockId: string; orgSlug: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await deleteCalendarBlock(blockId, orgSlug);
        })
      }
      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-60"
    >
      {isPending ? "…" : "Supprimer"}
    </button>
  );
}
