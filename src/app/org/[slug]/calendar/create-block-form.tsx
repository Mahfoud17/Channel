"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createCalendarBlock } from "@/app/actions/calendar-blocks";
import type { FormState } from "@/app/actions/reservations";

const initialState: FormState = { error: null };

const REASONS = [
  { value: "maintenance", label: "Travaux / maintenance" },
  { value: "owner", label: "Usage propriétaire" },
  { value: "other", label: "Autre" },
];

export function CreateBlockForm({
  units,
  orgSlug,
}: {
  units: { id: string; name: string }[];
  orgSlug: string;
}) {
  const [selectedUnit, setSelectedUnit] = useState(units[0]?.id ?? "");
  const action = createCalendarBlock.bind(null, selectedUnit, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (units.length === 0) {
    return <p className="text-sm text-neutral-500">Ajoute d&apos;abord une unité.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="block_unit_id" className="block text-sm font-medium text-neutral-700">
          Logement
        </label>
        <select
          id="block_unit_id"
          value={selectedUnit}
          onChange={(event) => setSelectedUnit(event.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="start_date" className="block text-sm font-medium text-neutral-700">
            Du
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="end_date" className="block text-sm font-medium text-neutral-700">
            Au
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reason" className="block text-sm font-medium text-neutral-700">
          Motif
        </label>
        <select
          id="reason"
          name="reason"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        >
          {REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
      >
        {isPending ? "Blocage…" : "Bloquer ces dates"}
      </button>
    </form>
  );
}
