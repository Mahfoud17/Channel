"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createReservation, type FormState } from "@/app/actions/reservations";

const initialState: FormState = { error: null };

export function CreateReservationForm({
  units,
  orgSlug,
}: {
  units: { id: string; name: string }[];
  orgSlug: string;
}) {
  const [selectedUnit, setSelectedUnit] = useState(units[0]?.id ?? "");
  // The unit is a bound argument of the server action (like elsewhere in the
  // app) rather than a plain form field, so the anti-double-booking check
  // and the exclusion-constraint error handling in createReservation always
  // run against the unit actually selected, not a stale hidden input.
  const action = createReservation.bind(null, selectedUnit, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (units.length === 0) {
    return <p className="text-sm text-neutral-500">Ajoute d&apos;abord une unité.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="unit_id" className="block text-sm font-medium text-neutral-700">
          Logement
        </label>
        <select
          id="unit_id"
          value={selectedUnit}
          onChange={(event) => setSelectedUnit(event.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom du voyageur" name="guest_first_name" required />
        <Field label="Nom du voyageur" name="guest_last_name" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" name="guest_email" type="email" />
        <Field label="Téléphone" name="guest_phone" type="tel" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Arrivée" name="check_in" type="date" required />
        <Field label="Départ" name="check_out" type="date" required />
        <Field label="Voyageurs" name="num_guests" type="number" defaultValue="2" min={1} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prix / nuit (€)" name="nightly_price" type="number" min={0} step="0.01" />
        <Field label="Frais de ménage (€)" name="cleaning_fee" type="number" min={0} step="0.01" />
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
        {isPending ? "Création…" : "Créer la réservation"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  min?: number;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        min={min}
        step={step}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}
