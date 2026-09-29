"use client";

import { useTransition } from "react";
import { deleteMessageTemplate, toggleMessageTemplate } from "@/app/actions/messaging";

export function TemplateActions({
  templateId,
  orgSlug,
  isActive,
}: {
  templateId: string;
  orgSlug: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-1.5 text-xs text-neutral-600">
        <input
          type="checkbox"
          checked={isActive}
          disabled={isPending}
          onChange={(e) => {
            const checked = e.target.checked;
            startTransition(async () => {
              await toggleMessageTemplate(templateId, orgSlug, checked);
            });
          }}
          className="rounded border-neutral-300 text-accent focus:ring-accent"
        />
        Actif
      </label>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => { await deleteMessageTemplate(templateId, orgSlug); })}
        className="text-xs text-critical hover:text-critical disabled:opacity-60"
      >
        Supprimer
      </button>
    </div>
  );
}
