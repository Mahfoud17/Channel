"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveUnit } from "@/app/actions/units";

export function DeleteUnitButton({
  unitId,
  unitName,
  propertyId,
  orgSlug,
}: {
  unitId: string;
  unitName: string;
  propertyId: string;
  orgSlug: string;
}) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="text-sm text-red-600 hover:text-red-800"
      >
        Supprimer cette unité
      </button>
    );
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-800">
        Supprimer définitivement <strong>{unitName}</strong> de la liste ? Le calendrier et
        l&apos;historique associés (à venir) resteront en base mais l&apos;unité ne sera plus
        gérable depuis l&apos;interface.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await archiveUnit(unitId, propertyId, orgSlug);
              if (result.error) {
                setError(result.error);
                return;
              }
              router.push(`/org/${orgSlug}/properties/${propertyId}`);
            });
          }}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Suppression…" : "Confirmer la suppression"}
        </button>
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Annuler
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
