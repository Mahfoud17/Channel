"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  acceptCleaningTask,
  declineCleaningTask,
  startCleaningTask,
  completeCleaningTask,
  reportCleaningIssue,
} from "@/app/actions/cleaning";
import { CleaningStatusBadge } from "@/components/cleaning-status-badge";

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

export type CleanerTask = {
  id: string;
  scheduled_date: string;
  status: string;
  unitName: string;
  propertyName: string | null;
  departingGuestLabel: string | null;
  checklistItems: string[];
};

type Mode = "idle" | "completing" | "reporting";

export function CleanerTaskCard({ task, orgId, orgSlug }: { task: CleanerTask; orgId: string; orgSlug: string }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {DATE_FORMAT.format(new Date(`${task.scheduled_date}T00:00:00Z`))}
          </p>
          <p className="text-base font-semibold text-neutral-900">{task.unitName}</p>
          {task.propertyName && <p className="text-sm text-neutral-500">{task.propertyName}</p>}
        </div>
        <CleaningStatusBadge status={task.status} />
      </div>

      {task.departingGuestLabel && (
        <p className="mt-2 text-sm text-neutral-600">Départ de {task.departingGuestLabel}</p>
      )}

      {mode === "idle" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {task.status === "proposed" && (
            <>
              <button
                disabled={isPending}
                onClick={() => run(() => acceptCleaningTask(task.id, orgSlug))}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                Accepter
              </button>
              <button
                disabled={isPending}
                onClick={() => run(() => declineCleaningTask(task.id, orgSlug))}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
              >
                Refuser
              </button>
            </>
          )}
          {task.status === "accepted" && (
            <button
              disabled={isPending}
              onClick={() => run(() => startCleaningTask(task.id, orgSlug))}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              Commencer le ménage
            </button>
          )}
          {task.status === "in_progress" && (
            <button
              onClick={() => setMode("completing")}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Terminer le ménage
            </button>
          )}
          {task.status !== "cancelled" && (
            <button
              onClick={() => setMode("reporting")}
              className="rounded-md border border-critical/40 px-4 py-2 text-sm text-critical hover:bg-critical-soft"
            >
              Signaler un problème
            </button>
          )}
        </div>
      )}

      {mode === "completing" && (
        <CompleteForm
          taskId={task.id}
          orgSlug={orgSlug}
          checklistItems={task.checklistItems}
          onCancel={() => setMode("idle")}
        />
      )}

      {mode === "reporting" && (
        <ReportIssueForm
          taskId={task.id}
          orgId={orgId}
          orgSlug={orgSlug}
          onCancel={() => setMode("idle")}
        />
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-critical">
          {error}
        </p>
      )}
    </div>
  );
}

function CompleteForm({
  taskId,
  orgSlug,
  checklistItems,
  onCancel,
}: {
  taskId: string;
  orgSlug: string;
  checklistItems: string[];
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4 space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-sm font-medium text-neutral-900">Checklist</p>
      <div className="space-y-2">
        {checklistItems.map((item) => (
          <label key={item} className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={checked[item] ?? false}
              onChange={(e) => setChecked((c) => ({ ...c, [item]: e.target.checked }))}
              className="rounded border-neutral-300 text-accent focus:ring-accent"
            />
            {item}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-critical">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await completeCleaningTask(taskId, orgSlug, checked);
              if (result.error) setError(result.error);
              else onCancel();
            });
          }}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {isPending ? "Envoi…" : "Confirmer, ménage terminé"}
        </button>
        <button
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function ReportIssueForm({
  taskId,
  orgId,
  orgSlug,
  onCancel,
}: {
  taskId: string;
  orgId: string;
  orgSlug: string;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsUploading(true);
    setError(null);
    const supabase = createClient();
    const extension = file.name.split(".").pop() ?? "jpg";
    const path = `${orgId}/${taskId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("cleaning-photos")
      .upload(path, file, { contentType: file.type });
    setIsUploading(false);
    if (uploadError) {
      setError("Échec de l'envoi de la photo.");
      return;
    }
    setPhotoPath(path);
  }

  return (
    <div className="mt-4 space-y-3 rounded-md border border-critical/30 bg-critical-soft p-3">
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Décris le problème (ex. robinet qui fuit, serviette manquante...)"
        rows={3}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />
      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
        >
          {isUploading ? "Envoi…" : photoPath ? "Photo ajoutée ✓" : "Ajouter une photo"}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
      {error && <p className="text-sm text-critical">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={isPending || isUploading}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await reportCleaningIssue(taskId, orgSlug, description, photoPath);
              if (result.error) setError(result.error);
              else onCancel();
            });
          }}
          className="rounded-md bg-critical px-4 py-2 text-sm font-medium text-white hover:bg-critical/90 disabled:opacity-60"
        >
          {isPending ? "Envoi…" : "Envoyer le signalement"}
        </button>
        <button
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
