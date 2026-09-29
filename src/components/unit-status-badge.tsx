const STYLES: Record<string, string> = {
  active: "bg-good-soft text-good",
  inactive: "bg-neutral-200 text-neutral-700",
  maintenance: "bg-warn-soft text-warn",
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
