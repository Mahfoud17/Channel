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
        className="text-sm text-critical hover:text-critical"
      >
        Supprimer cette unité
      </button>
    );
  }

  return (
    <div className="rounded-md border border-critical/30 bg-critical-soft p-3">
      <p className="text-sm text-critical">
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
          className="rounded-md bg-critical px-3 py-1.5 text-sm font-medium text-white hover:bg-critical/90 disabled:opacity-60"
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
        <p role="alert" className="mt-2 text-sm text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
