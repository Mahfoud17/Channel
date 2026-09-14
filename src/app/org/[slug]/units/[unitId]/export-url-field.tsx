"use client";

import { useState } from "react";

export function ExportUrlField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex gap-2">
      <input
        type="text"
        readOnly
        value={url}
        onFocus={(event) => event.target.select()}
        className="flex-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-700 outline-none"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard API can be unavailable (permissions, non-HTTPS) —
            // the field is still selectable/copyable manually.
          }
        }}
        className="shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-100"
      >
        {copied ? "Copié !" : "Copier"}
      </button>
    </div>
  );
}
