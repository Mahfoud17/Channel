"use client";

import { useActionState } from "react";
import { createCompetitor } from "@/app/actions/competitors";
import type { FormState } from "@/app/actions/reservations";

const initialState: FormState = { error: null };

export function AddCompetitorForm({ unitId, orgSlug }: { unitId: string; orgSlug: string }) {
  const action = createCompetitor.bind(null, unitId, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <input
          name="name"
          type="text"
          required
          placeholder="Nom (ex. Appart Cosy Lyon 2)"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 sm:col-span-2"
        />
        <input
          name="platform"
          type="text"
          placeholder="Plateforme (Airbnb…)"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
        <input
          name="url"
          type="url"
          placeholder="URL de l'annonce"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
      >
        {isPending ? "Ajout…" : "Ajouter un concurrent"}
      </button>
    </form>
  );
}
