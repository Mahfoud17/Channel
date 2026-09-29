"use client";

import { useActionState } from "react";
import { createUnit } from "@/app/actions/units";
import type { FormState } from "@/app/actions/properties";

const initialState: FormState = { error: null };

const UNIT_TYPES = [
  { value: "appartement", label: "Appartement" },
  { value: "studio", label: "Studio" },
  { value: "maison", label: "Maison" },
  { value: "chambre", label: "Chambre" },
  { value: "autre", label: "Autre" },
];

export function CreateUnitForm({ propertyId, orgSlug }: { propertyId: string; orgSlug: string }) {
  const action = createUnit.bind(null, propertyId, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
            Nom de l&apos;unité
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="ex. Studio 2A"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="unit_type" className="block text-sm font-medium text-neutral-700">
            Type
          </label>
          <select
            id="unit_type"
            name="unit_type"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {UNIT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField label="Chambres" name="bedrooms" defaultValue={1} />
        <NumberField label="Lits" name="beds" defaultValue={1} />
        <NumberField label="Voyageurs max" name="max_guests" defaultValue={2} />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-critical">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {isPending ? "Création…" : "Ajouter l'unité"}
      </button>
    </form>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={0}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}
