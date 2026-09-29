"use client";

import { useActionState } from "react";
import { createOrganization, type CreateOrganizationState } from "@/app/actions/organizations";

const initialState: CreateOrganizationState = { error: null };

export function CreateOrganizationForm() {
  const [state, formAction, isPending] = useActionState(createOrganization, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
          Nom de l&apos;organisation
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="ex. Lyon Séjours"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-critical">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {isPending ? "Création…" : "Créer l'organisation"}
      </button>
    </form>
  );
}
