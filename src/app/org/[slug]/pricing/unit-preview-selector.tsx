"use client";

import { useRouter } from "next/navigation";

export function UnitPreviewSelector({
  units,
  selectedUnitId,
}: {
  units: { id: string; name: string }[];
  selectedUnitId: string;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedUnitId}
      onChange={(e) => router.push(`?unit=${e.target.value}`)}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
    >
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.name}
        </option>
      ))}
    </select>
  );
}
