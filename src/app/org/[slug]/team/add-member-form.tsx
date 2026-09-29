"use client";

import { useActionState } from "react";
import { addMemberByEmail } from "@/app/actions/members";
import type { FormState } from "@/app/actions/reservations";

const initialState: FormState = { error: null };

const ROLES = [
  { value: "cleaner", label: "Femme de ménage" },
  { value: "manager", label: "Gestionnaire" },
  { value: "admin", label: "Administrateur" },
  { value: "owner", label: "Propriétaire" },
];

export function AddMemberForm({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const action = addMemberByEmail.bind(null, orgId, orgSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
            Email du compte existant
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="marie@exemple.com"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="role" className="block text-sm font-medium text-neutral-700">
            Rôle
          </label>
          <select
            id="role"
            name="role"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
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
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {isPending ? "Ajout…" : "Ajouter"}
      </button>
    </form>
  );
}
