"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createPricingRule } from "@/app/actions/pricing";
import type { FormState } from "@/app/actions/reservations";

const initialState: FormState = { error: null };

const RULE_TYPES = [
  { value: "weekend", label: "Weekend (vendredi/samedi)" },
  { value: "occupancy_high", label: "Occupation forte" },
  { value: "occupancy_low", label: "Occupation faible" },
  { value: "length_of_stay", label: "Durée de séjour" },
  { value: "last_minute", label: "Dernière minute" },
];

export function CreateRuleForm({
  orgId,
  orgSlug,
  units,
}: {
  orgId: string;
  orgSlug: string;
  units: { id: string; name: string }[];
}) {
  const action = createPricingRule.bind(null, orgId, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [ruleType, setRuleType] = useState("weekend");

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="unit_id" className="block text-sm font-medium text-neutral-700">
            Portée
          </label>
          <select
            id="unit_id"
            name="unit_id"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          >
            <option value="">Toute l&apos;organisation</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} uniquement
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rule_type" className="block text-sm font-medium text-neutral-700">
            Type de règle
          </label>
          <select
            id="rule_type"
            name="rule_type"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          >
            {RULE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Field label="Libellé (affiché dans le détail du prix)" name="label" placeholder="ex. Forte occupation J-30" required />

      {(ruleType === "occupancy_high" || ruleType === "occupancy_low") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fenêtre (jours, ex. 30/14/7)" name="lookahead_days" type="number" min={1} required />
          <Field label="Seuil d'occupation (%)" name="occupancy_threshold_pct" type="number" min={0} max={100} required />
        </div>
      )}

      {ruleType === "length_of_stay" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nuits minimum" name="min_nights" type="number" min={1} />
          <Field label="Nuits maximum (vide = illimité)" name="max_nights" type="number" min={1} />
        </div>
      )}

      {ruleType === "last_minute" && (
        <Field label="S'applique si arrivée dans les N jours" name="days_before_checkin_max" type="number" min={0} required />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="adjustment_type" className="block text-sm font-medium text-neutral-700">
            Type d&apos;ajustement
          </label>
          <select
            id="adjustment_type"
            name="adjustment_type"
            defaultValue="percent"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          >
            <option value="percent">Pourcentage</option>
            <option value="fixed">Montant fixe (€)</option>
          </select>
        </div>
        <Field
          label="Valeur (négatif = réduction)"
          name="adjustment_value"
          type="number"
          step="0.01"
          placeholder="ex. 20 ou -15"
          required
        />
        <Field label="Priorité (ordre d'application, 0 = en premier)" name="priority" type="number" defaultValue="0" />
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
        {isPending ? "Création…" : "Créer la règle"}
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
  max,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  min?: number;
  max?: number;
  step?: string;
  placeholder?: string;
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
        max={max}
        step={step}
        placeholder={placeholder}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
      />
    </div>
  );
}
