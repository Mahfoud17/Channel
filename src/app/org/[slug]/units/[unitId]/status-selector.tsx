"use client";

import { useTransition } from "react";
import { updateUnitStatus } from "@/app/actions/units";

const STATUSES = [
  { value: "active", label: "Actif" },
  { value: "inactive", label: "Inactif" },
  { value: "maintenance", label: "Maintenance" },
];

export function StatusSelector({
  unitId,
  propertyId,
  orgSlug,
  currentStatus,
}: {
  unitId: string;
  propertyId: string;
  orgSlug: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentStatus}
      disabled={isPending}
      onChange={(event) => {
        const status = event.target.value;
        startTransition(() => {
          updateUnitStatus(unitId, propertyId, orgSlug, status);
        });
      }}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:opacity-60"
    >
      {STATUSES.map((status) => (
        <option key={status.value} value={status.value}>
          {status.label}
        </option>
      ))}
    </select>
  );
}
