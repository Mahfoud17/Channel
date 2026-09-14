"use client";

import { useActionState } from "react";
import { createProperty, type FormState } from "@/app/actions/properties";

const initialState: FormState = { error: null };

export function CreatePropertyForm({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const action = createProperty.bind(null, orgId, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du logement" name="name" placeholder="ex. Lyon Presqu'île" required />
        <Field label="Pays" name="country" placeholder="FR" />
      </div>
      <Field label="Adresse" name="address_line1" placeholder="12 rue de la République" required />
      <Field label="Complément d'adresse" name="address_line2" placeholder="Bâtiment B, 3ème étage" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ville" name="city" placeholder="Lyon" required />
        <Field label="Code postal" name="postal_code" placeholder="69002" required />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {isPending ? "Création…" : "Créer le logement"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
      />
    </div>
  );
}
