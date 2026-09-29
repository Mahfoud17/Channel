"use client";

import { useActionState } from "react";
import { updateProperty } from "@/app/actions/properties";
import type { FormState } from "@/app/actions/properties";

const initialState: FormState = { error: null };

type Property = {
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postal_code: string;
  country: string;
};

export function EditPropertyForm({
  property,
  propertyId,
  orgSlug,
}: {
  property: Property;
  propertyId: string;
  orgSlug: string;
}) {
  const action = updateProperty.bind(null, propertyId, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du logement" name="name" defaultValue={property.name} required />
        <Field label="Pays" name="country" defaultValue={property.country} />
      </div>
      <Field label="Adresse" name="address_line1" defaultValue={property.address_line1} required />
      <Field
        label="Complément d'adresse"
        name="address_line2"
        defaultValue={property.address_line2 ?? ""}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ville" name="city" defaultValue={property.city} required />
        <Field label="Code postal" name="postal_code" defaultValue={property.postal_code} required />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-critical">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={isPending} className="btn btn-primary">
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        required={required}
        className="field"
      />
    </div>
  );
}
