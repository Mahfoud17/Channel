"use client";

import { useState, useTransition } from "react";
import { cancelReservation } from "@/app/actions/reservations";

export function CancelReservationButton({
  reservationId,
  orgSlug,
}: {
  reservationId: string;
  orgSlug: string;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="rounded-md border border-critical/40 px-3 py-1.5 text-sm text-critical hover:bg-critical-soft"
      >
        Annuler la réservation
      </button>
    );
  }

  return (
    <div className="rounded-md border border-critical/30 bg-critical-soft p-3">
      <p className="text-sm text-critical">
        Confirmer l&apos;annulation ? Les dates redeviennent immédiatement disponibles sur le
        calendrier.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await cancelReservation(reservationId, orgSlug);
              if (result.error) setError(result.error);
            });
          }}
          className="rounded-md bg-critical px-3 py-1.5 text-sm font-medium text-white hover:bg-critical/90 disabled:opacity-60"
        >
          {isPending ? "Annulation…" : "Confirmer"}
        </button>
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Retour
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
