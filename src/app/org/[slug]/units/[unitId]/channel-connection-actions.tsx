"use client";

import { useState, useTransition } from "react";
import { triggerChannelSync, deleteChannelConnection } from "@/app/actions/channels";

export function ChannelConnectionActions({
  connectionId,
  unitId,
  orgSlug,
}: {
  connectionId: string;
  unitId: string;
  orgSlug: string;
}) {
  const [isSyncing, startSync] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={isSyncing || isDeleting}
        onClick={() => {
          setError(null);
          startSync(async () => {
            const result = await triggerChannelSync(connectionId, unitId, orgSlug);
            if (result.error) setError(result.error);
          });
        }}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
      >
        {isSyncing ? "Synchronisation…" : "Synchroniser maintenant"}
      </button>
      <button
        type="button"
        disabled={isSyncing || isDeleting}
        onClick={() => {
          startDelete(() => {
            deleteChannelConnection(connectionId, unitId, orgSlug);
          });
        }}
        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-60"
      >
        {isDeleting ? "…" : "Supprimer"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
