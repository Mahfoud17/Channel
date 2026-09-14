"use client";

import { useState, useTransition } from "react";
import { saveChecklistTemplate } from "@/app/actions/cleaning";

export function ChecklistEditor({
  unitId,
  orgSlug,
  initialItems,
}: {
  unitId: string;
  orgSlug: string;
  initialItems: string[];
}) {
  const [text, setText] = useState(initialItems.join("\n"));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">
        Un élément par ligne — c&apos;est cette liste que la femme de ménage coche en terminant un
        ménage sur ce logement.
      </p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={8}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          const items = text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          startTransition(async () => {
            const result = await saveChecklistTemplate(unitId, orgSlug, items);
            if (result.error) setError(result.error);
            else setSaved(true);
          });
        }}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {isPending ? "Enregistrement…" : saved ? "Enregistré ✓" : "Enregistrer la checklist"}
      </button>
    </div>
  );
}
