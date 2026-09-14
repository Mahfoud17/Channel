const STYLES: Record<string, string> = {
  unassigned: "bg-neutral-200 text-neutral-700",
  proposed: "bg-blue-100 text-blue-800",
  accepted: "bg-sky-100 text-sky-800",
  in_progress: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
  needs_inspection: "bg-purple-100 text-purple-800",
  problem: "bg-red-100 text-red-700",
  cancelled: "bg-neutral-200 text-neutral-500",
};

const LABELS: Record<string, string> = {
  unassigned: "À attribuer",
  proposed: "Proposé",
  accepted: "Accepté",
  in_progress: "En cours",
  done: "Terminé",
  needs_inspection: "Contrôle requis",
  problem: "Problème",
  cancelled: "Annulé",
};

export function CleaningStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STYLES[status] ?? STYLES.unassigned
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
