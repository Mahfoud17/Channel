"use client";

import { useActionState } from "react";
import { updateUnitDetails } from "@/app/actions/units";
import type { FormState } from "@/app/actions/properties";

const initialState: FormState = { error: null };

type Unit = {
  name: string;
  bedrooms: number;
  beds: number;
  max_guests: number;
  has_elevator: boolean;
  has_parking: boolean;
  amenities: string[];
  access_instructions: string | null;
  keybox_code: string | null;
  wifi_ssid: string | null;
  wifi_password: string | null;
  base_price: number | null;
  min_price: number | null;
  max_price: number | null;
};

export function EditUnitForm({
  unit,
  unitId,
  propertyId,
  orgSlug,
}: {
  unit: Unit;
  unitId: string;
  propertyId: string;
  orgSlug: string;
}) {
  const action = updateUnitDetails.bind(null, unitId, propertyId, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Nom" name="name" defaultValue={unit.name} required />
        <NumberField label="Chambres" name="bedrooms" defaultValue={unit.bedrooms} />
        <NumberField label="Lits" name="beds" defaultValue={unit.beds} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Voyageurs max" name="max_guests" defaultValue={unit.max_guests} />
        <TextField
          label="Équipements (séparés par une virgule)"
          name="amenities"
          defaultValue={unit.amenities.join(", ")}
          placeholder="lave-linge, climatisation, terrasse"
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="has_elevator"
            defaultChecked={unit.has_elevator}
            className="rounded border-neutral-300 text-accent focus:ring-accent"
          />
          Ascenseur
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="has_parking"
            defaultChecked={unit.has_parking}
            className="rounded border-neutral-300 text-accent focus:ring-accent"
          />
          Parking
        </label>
      </div>

      <TextField
        label="Instructions d'accès"
        name="access_instructions"
        defaultValue={unit.access_instructions ?? ""}
        textarea
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Code boîte à clés" name="keybox_code" defaultValue={unit.keybox_code ?? ""} />
        <TextField label="Wi-Fi (SSID)" name="wifi_ssid" defaultValue={unit.wifi_ssid ?? ""} />
        <TextField
          label="Wi-Fi (mot de passe)"
          name="wifi_password"
          defaultValue={unit.wifi_password ?? ""}
        />
      </div>

      <div className="border-t border-neutral-100 pt-4">
        <p className="mb-3 text-sm font-medium text-neutral-700">Tarifs de base</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <PriceField label="Prix de base / nuit (€)" name="base_price" defaultValue={unit.base_price} />
          <PriceField label="Prix minimum (€)" name="min_price" defaultValue={unit.min_price} />
          <PriceField label="Prix maximum (€)" name="max_price" defaultValue={unit.max_price} />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Le prix de base sert de point de départ au moteur de pricing (min/max plafonnent ses
          recommandations) — la page Pricing de ce logement en montre le résultat.
        </p>
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
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  textarea,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      ) : (
        <input
          id={name}
          name={name}
          type="text"
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      )}
    </div>
  );
}

function PriceField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number | null;
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
        step="0.01"
        defaultValue={defaultValue ?? ""}
        placeholder="—"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />
    </div>
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
