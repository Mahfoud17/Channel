const STYLES: Record<string, string> = {
  unassigned: "bg-neutral-200 text-neutral-700",
  proposed: "bg-accent-soft text-accent",
  accepted: "bg-brass-soft text-brass",
  in_progress: "bg-warn-soft text-warn",
  done: "bg-good-soft text-good",
  needs_inspection: "bg-purple-100 text-purple-800",
  problem: "bg-critical-soft text-critical",
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
