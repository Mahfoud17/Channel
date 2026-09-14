import { requireOrgContext } from "@/lib/org";
import { MessageQueueItem } from "./message-queue-item";
import { CreateTemplateForm } from "./create-template-form";
import { TemplateActions } from "./template-actions";

const TRIGGER_LABELS: Record<string, string> = {
  on_created: "À la création",
  before_checkin: "Avant l'arrivée",
  after_checkin: "Après l'arrivée",
  before_checkout: "Avant le départ",
  after_checkout: "Après le départ",
};

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export default async function MessagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, org } = await requireOrgContext(slug);
  const nowIso = new Date().toISOString();

  const { data: dueMessages } = await supabase
    .from("scheduled_messages")
    .select("id, recipient_name, recipient_email, subject, body, send_at")
    .eq("status", "pending")
    .lte("send_at", nowIso)
    .order("send_at", { ascending: true });

  const { data: upcomingMessages } = await supabase
    .from("scheduled_messages")
    .select("id, recipient_name, send_at, unit_id, units(name)")
    .eq("status", "pending")
    .gt("send_at", nowIso)
    .order("send_at", { ascending: true })
    .limit(20);

  const { data: templates } = await supabase
    .from("message_templates")
    .select("id, name, trigger_type, offset_days, is_active")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Messages</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Aucun fournisseur d&apos;envoi connecté — les messages sont pré-rédigés et prêts à copier,
          pas envoyés automatiquement.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">
          À envoyer maintenant {dueMessages && dueMessages.length > 0 && `(${dueMessages.length})`}
        </h2>
        {!dueMessages || dueMessages.length === 0 ? (
          <p className="text-sm text-neutral-500">Rien à envoyer pour l&apos;instant.</p>
        ) : (
          <div className="space-y-2">
            {dueMessages.map((m) => (
              <MessageQueueItem
                key={m.id}
                messageId={m.id}
                orgSlug={org.slug}
                recipientName={m.recipient_name}
                recipientEmail={m.recipient_email}
                subject={m.subject}
                body={m.body}
              />
            ))}
          </div>
        )}
      </section>

      {upcomingMessages && upcomingMessages.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-neutral-900">Programmés à venir</h2>
          <ul className="space-y-1 text-sm text-neutral-600">
            {upcomingMessages.map((m) => {
              const unit = Array.isArray(m.units) ? m.units[0] : m.units;
              return (
                <li key={m.id} className="flex justify-between rounded-md border border-neutral-100 px-3 py-1.5">
                  <span>
                    {m.recipient_name || "Voyageur"} {unit?.name && `— ${unit.name}`}
                  </span>
                  <span className="text-neutral-400">{DATE_FORMAT.format(new Date(m.send_at))}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">Modèles</h2>
        {!templates || templates.length === 0 ? (
          <p className="text-sm text-neutral-500">Aucun modèle pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-neutral-900">{t.name}</p>
                  <p className="text-xs text-neutral-500">
                    {TRIGGER_LABELS[t.trigger_type] ?? t.trigger_type}
                    {t.trigger_type !== "on_created" && ` (${t.offset_days}j)`}
                  </p>
                </div>
                <TemplateActions templateId={t.id} orgSlug={org.slug} isActive={t.is_active} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Créer un modèle</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Un message est généré automatiquement pour chaque nouvelle réservation (y compris importées
          via iCal), à la date calculée par le déclencheur.
        </p>
        <div className="mt-4">
          <CreateTemplateForm orgId={org.id} orgSlug={org.slug} />
        </div>
      </section>
    </div>
  );
}
