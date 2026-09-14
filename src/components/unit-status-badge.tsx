const STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-neutral-200 text-neutral-700",
  maintenance: "bg-amber-100 text-amber-800",
};

const LABELS: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  maintenance: "Maintenance",
};

export function UnitStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STYLES[status] ?? STYLES.inactive
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
