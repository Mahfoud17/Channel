const STYLES: Record<string, string> = {
  inquiry: "bg-neutral-200 text-neutral-700",
  pending: "bg-warn-soft text-warn",
  confirmed: "bg-good-soft text-good",
  modified: "bg-brass-soft text-brass",
  cancelled: "bg-critical-soft text-critical",
  completed: "bg-neutral-200 text-neutral-700",
  no_show: "bg-critical-soft text-critical",
};

const LABELS: Record<string, string> = {
  inquiry: "Demande",
  pending: "En attente",
  confirmed: "Confirmée",
  modified: "Modifiée",
  cancelled: "Annulée",
  completed: "Terminée",
  no_show: "No-show",
};

export function ReservationStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STYLES[status] ?? STYLES.pending
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
