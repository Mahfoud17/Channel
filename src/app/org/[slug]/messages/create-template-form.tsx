"use client";

import { useActionState } from "react";
import { createMessageTemplate } from "@/app/actions/messaging";
import type { FormState } from "@/app/actions/reservations";

const initialState: FormState = { error: null };

const TRIGGERS = [
  { value: "on_created", label: "À la création de la réservation" },
  { value: "before_checkin", label: "Avant l'arrivée (J-N)" },
  { value: "after_checkin", label: "Après l'arrivée (J+N)" },
  { value: "before_checkout", label: "Avant le départ (J-N)" },
  { value: "after_checkout", label: "Après le départ (J+N)" },
];

const VARIABLES = [
  "{{prenom}}",
  "{{nom}}",
  "{{nom_logement}}",
  "{{date_arrivee}}",
  "{{date_depart}}",
  "{{code_acces}}",
  "{{adresse}}",
  "{{wifi}}",
];

export function CreateTemplateForm({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const action = createMessageTemplate.bind(null, orgId, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
            Nom du modèle
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="ex. Instructions d'arrivée"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="offset_days" className="block text-sm font-medium text-neutral-700">
            Décalage (jours)
          </label>
          <input
            id="offset_days"
            name="offset_days"
            type="number"
            min={0}
            defaultValue={0}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="trigger_type" className="block text-sm font-medium text-neutral-700">
          Déclencheur
        </label>
        <select
          id="trigger_type"
          name="trigger_type"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        >
          {TRIGGERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="subject" className="block text-sm font-medium text-neutral-700">
          Objet (email)
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          placeholder="ex. Votre arrivée chez {{nom_logement}}"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="body" className="block text-sm font-medium text-neutral-700">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={6}
          placeholder={`Bonjour {{prenom}},\n\nVotre logement ${"{{nom_logement}}"} vous attend le {{date_arrivee}}.\nCode d'accès : {{code_acces}}\nWi-Fi : {{wifi}}\nAdresse : {{adresse}}`}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
        <p className="text-xs text-neutral-500">
          Variables disponibles :{" "}
          {VARIABLES.map((v) => (
            <code key={v} className="mr-1 rounded bg-neutral-100 px-1 py-0.5">
              {v}
            </code>
          ))}
        </p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {isPending ? "Création…" : "Créer le modèle"}
      </button>
    </form>
  );
}
