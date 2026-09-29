"use client";

import { useActionState } from "react";
import { createChannelConnection } from "@/app/actions/channels";
import type { FormState } from "@/app/actions/reservations";

const initialState: FormState = { error: null };

const CHANNEL_OPTIONS = [
  { value: "airbnb", label: "Airbnb" },
  { value: "vrbo", label: "Vrbo / Abritel" },
  { value: "booking", label: "Booking.com (export seul, voir note)" },
  { value: "other", label: "Autre plateforme" },
];

export function AddChannelForm({ unitId, orgSlug }: { unitId: string; orgSlug: string }) {
  const action = createChannelConnection.bind(null, unitId, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="channel_type" className="block text-sm font-medium text-neutral-700">
            Plateforme
          </label>
          <select
            id="channel_type"
            name="channel_type"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {CHANNEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ical_import_url" className="block text-sm font-medium text-neutral-700">
            URL du flux iCal à importer
          </label>
          <input
            id="ical_import_url"
            name="ical_import_url"
            type="url"
            required
            placeholder="https://www.airbnb.fr/calendar/ical/..."
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
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
        {isPending ? "Ajout…" : "Ajouter la connexion"}
      </button>
    </form>
  );
}
