"use client";

import { useActionState, useTransition } from "react";
import { addCompetitorPrice, deleteCompetitor } from "@/app/actions/competitors";
import type { FormState } from "@/app/actions/reservations";

const initialState: FormState = { error: null };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LogPriceForm({ competitorId, orgSlug }: { competitorId: string; orgSlug: string }) {
  const action = addCompetitorPrice.bind(null, competitorId, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [isDeleting, startDelete] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <form action={formAction} className="flex items-center gap-1.5">
        <input
          name="observed_date"
          type="date"
          defaultValue={today()}
          required
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
        <input
          name="price"
          type="number"
          min={0}
          step="0.01"
          placeholder="Prix €"
          required
          className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
        >
          {isPending ? "…" : "Enregistrer"}
        </button>
      </form>
      <button
        type="button"
        disabled={isDeleting}
        onClick={() =>
          startDelete(async () => {
            await deleteCompetitor(competitorId, orgSlug);
          })
        }
        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-60"
      >
        Supprimer
      </button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
