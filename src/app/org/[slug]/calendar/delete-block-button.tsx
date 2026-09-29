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
      className="text-sm text-critical hover:text-critical disabled:opacity-60"
    >
      {isPending ? "…" : "Supprimer"}
    </button>
  );
}
