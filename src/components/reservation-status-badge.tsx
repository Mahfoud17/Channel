const STYLES: Record<string, string> = {
  inquiry: "bg-neutral-200 text-neutral-700",
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  modified: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-neutral-200 text-neutral-700",
  no_show: "bg-red-100 text-red-700",
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
