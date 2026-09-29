"use client";

import { useState, useTransition } from "react";
import { cancelScheduledMessage, markMessageSent } from "@/app/actions/messaging";

export function MessageQueueItem({
  messageId,
  orgSlug,
  recipientName,
  recipientEmail,
  subject,
  body,
}: {
  messageId: string;
  orgSlug: string;
  recipientName: string | null;
  recipientEmail: string | null;
  subject: string | null;
  body: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fullText = subject ? `Objet : ${subject}\n\n${body}` : body;

  return (
    <div className="rounded-lg border border-neutral-200 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-left font-medium text-neutral-900 hover:text-accent"
        >
          {recipientName || "Voyageur"}
          {recipientEmail && <span className="ml-1 font-normal text-neutral-500">({recipientEmail})</span>}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fullText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // Clipboard API can be unavailable — the text is still
                // visible to select manually via "Voir le message".
              }
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
          >
            {copied ? "Copié !" : "Copier"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => { await markMessageSent(messageId, orgSlug); })}
            className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            Marquer envoyé
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => { await cancelScheduledMessage(messageId, orgSlug); })}
            className="text-xs text-critical hover:text-critical disabled:opacity-60"
          >
            Annuler
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 rounded-md bg-neutral-50 p-2 text-xs text-neutral-700">
          {subject && <p className="mb-1 font-medium">Objet : {subject}</p>}
          <p className="whitespace-pre-wrap">{body}</p>
        </div>
      )}
    </div>
  );
}
