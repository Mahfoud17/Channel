"use client";

import { useTransition } from "react";
import { assignCleaningTask } from "@/app/actions/cleaning";

export function AssignCleanerSelect({
  taskId,
  orgSlug,
  currentAssignee,
  cleaners,
}: {
  taskId: string;
  orgSlug: string;
  currentAssignee: string | null;
  cleaners: { id: string; label: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentAssignee ?? ""}
      disabled={isPending}
      onChange={(event) => {
        const cleanerId = event.target.value;
        if (!cleanerId) return;
        startTransition(() => {
          assignCleaningTask(taskId, cleanerId, orgSlug);
        });
      }}
      className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-60"
    >
      <option value="" disabled>
        Attribuer à…
      </option>
      {cleaners.map((cleaner) => (
        <option key={cleaner.id} value={cleaner.id}>
          {cleaner.label}
        </option>
      ))}
    </select>
  );
}
