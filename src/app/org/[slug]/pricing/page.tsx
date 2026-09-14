import Link from "next/link";
import { requireOrgContext, canManageProperties } from "@/lib/org";
import { addDays } from "@/lib/calendar";
import { computeOccupancyPct, computeRecommendedPrice, type PricingRule } from "@/lib/pricing/engine";
import { computeCompSetStats, computePositioningPct } from "@/lib/pricing/compset";
import { CreateRuleForm } from "./create-rule-form";
import { RuleActions } from "./rule-actions";
import { UnitPreviewSelector } from "./unit-preview-selector";
import { AddCompetitorForm } from "./add-competitor-form";
import { LogPriceForm } from "./log-price-form";

const RULE_TYPE_LABELS: Record<string, string> = {
  weekend: "Weekend",
  occupancy_high: "Occupation forte",
  occupancy_low: "Occupation faible",
  length_of_stay: "Durée de séjour",
  last_minute: "Dernière minute",
};

const PREVIEW_DAYS = 14;
const PREVIEW_STAY_NIGHTS = 3;
const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function PricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ unit?: string }>;
}) {
  const { slug } = await params;
  const { unit: unitParam } = await searchParams;
  const { supabase, org, role } = await requireOrgContext(slug);
  const canManage = canManageProperties(role);

  const { data: units } = await supabase
    .from("units")
    .select("id, name, base_price, min_price, max_price")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const unitList = units ?? [];
  const selectedUnit = unitList.find((u) => u.id === unitParam) ?? unitList[0] ?? null;

  const { data: rules } = await supabase
    .from("pricing_rules")
    .select(
      "id, unit_id, rule_type, label, lookahead_days, occupancy_threshold_pct, min_nights, max_nights, days_before_checkin_max, adjustment_type, adjustment_value, priority, is_active",
    )
    .order("priority", { ascending: true });

  const allRules = rules ?? [];

  let preview: { date: string; price: number; breakdown: { label: string; delta: number }[] }[] = [];

  if (selectedUnit && selectedUnit.base_price != null) {
    const applicableRaw = allRules.filter(
      (r) => r.is_active && (r.unit_id === null || r.unit_id === selectedUnit.id),
    );
    const pricingRules: PricingRule[] = applicableRaw.map((r) => ({
      id: r.id,
      ruleType: r.rule_type,
      label: r.label,
      lookaheadDays: r.lookahead_days,
      occupancyThresholdPct: r.occupancy_threshold_pct,
      minNights: r.min_nights,
      maxNights: r.max_nights,
      daysBeforeCheckinMax: r.days_before_checkin_max,
      adjustmentType: r.adjustment_type,
      adjustmentValue: Number(r.adjustment_value),
      priority: r.priority,
      isActive: r.is_active,
    }));

    // Fetch enough of this unit's calendar to compute occupancy for every
    // rule's lookahead window from every previewed date — the longest
    // window used in practice is J-30, and the preview itself spans 14
    // days, so 45 days of reservations comfortably covers every case.
    const horizonEnd = addDays(today(), PREVIEW_DAYS + 30);
    const { data: reservations } = await supabase
      .from("reservations")
      .select("check_in, check_out")
      .eq("unit_id", selectedUnit.id)
      .neq("status", "cancelled")
      .lt("check_in", horizonEnd);

    const bookedDates = new Set<string>();
    for (const r of reservations ?? []) {
      let d = r.check_in;
      while (d < r.check_out) {
        bookedDates.add(d);
        d = addDays(d, 1);
      }
    }

    const todayStr = today();
    preview = Array.from({ length: PREVIEW_DAYS }, (_, i) => {
      const date = addDays(todayStr, i);
      const result = computeRecommendedPrice(pricingRules, {
        basePrice: Number(selectedUnit.base_price),
        minPrice: selectedUnit.min_price != null ? Number(selectedUnit.min_price) : null,
        maxPrice: selectedUnit.max_price != null ? Number(selectedUnit.max_price) : null,
        date,
        today: todayStr,
        stayNights: PREVIEW_STAY_NIGHTS,
        occupancyByLookahead: (lookaheadDays) => computeOccupancyPct(bookedDates, date, lookaheadDays),
      });
      return { date, price: result.price, breakdown: result.breakdown };
    });
  }

  let competitors: {
    id: string;
    name: string;
    platform: string | null;
    url: string | null;
    latestPrice: number | null;
    latestDate: string | null;
  }[] = [];
  let compStats: ReturnType<typeof computeCompSetStats> = null;
  let positioningPct: number | null = null;

  if (selectedUnit) {
    const { data: rawCompetitors } = await supabase
      .from("competitors")
      .select("id, name, platform, url")
      .eq("unit_id", selectedUnit.id)
      .order("created_at", { ascending: true });

    const competitorIds = (rawCompetitors ?? []).map((c) => c.id);
    const { data: prices } = await supabase
      .from("competitor_prices")
      .select("competitor_id, observed_date, price")
      .in("competitor_id", competitorIds.length > 0 ? competitorIds : ["00000000-0000-0000-0000-000000000000"])
      .order("observed_date", { ascending: false });

    const latestByCompetitor = new Map<string, { price: number; date: string }>();
    for (const p of prices ?? []) {
      if (!latestByCompetitor.has(p.competitor_id)) {
        latestByCompetitor.set(p.competitor_id, { price: Number(p.price), date: p.observed_date });
      }
    }

    competitors = (rawCompetitors ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      url: c.url,
      latestPrice: latestByCompetitor.get(c.id)?.price ?? null,
      latestDate: latestByCompetitor.get(c.id)?.date ?? null,
    }));

    const latestPrices = [...latestByCompetitor.values()].map((v) => v.price);
    compStats = computeCompSetStats(latestPrices);
    if (compStats && selectedUnit.base_price != null) {
      positioningPct = computePositioningPct(Number(selectedUnit.base_price), compStats.average);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Pricing</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Mode manuel — ces prix sont des recommandations. Rien n&apos;est jamais appliqué
          automatiquement à une réservation.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-neutral-900">
            Aperçu — prix recommandé pour un séjour de {PREVIEW_STAY_NIGHTS} nuits
          </h2>
          {unitList.length > 0 && selectedUnit && (
            <UnitPreviewSelector units={unitList} selectedUnitId={selectedUnit.id} />
          )}
        </div>

        {!selectedUnit ? (
          <p className="mt-3 text-sm text-neutral-500">
            Aucune unité —{" "}
            <Link href={`/org/${org.slug}/properties`} className="text-emerald-700 underline">
              ajoute un logement
            </Link>
            .
          </p>
        ) : selectedUnit.base_price == null ? (
          <p className="mt-3 text-sm text-neutral-500">
            Ce logement n&apos;a pas de prix de base —{" "}
            <Link href={`/org/${org.slug}/units/${selectedUnit.id}`} className="text-emerald-700 underline">
              renseigne-le sur sa fiche
            </Link>{" "}
            pour voir un aperçu.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <div className="flex gap-2 pb-2">
              {preview.map((day) => (
                <div
                  key={day.date}
                  title={day.breakdown.map((b) => `${b.label}: ${b.delta >= 0 ? "+" : ""}${b.delta.toFixed(2)} €`).join("\n") || "Prix de base, aucune règle appliquée"}
                  className="min-w-[88px] shrink-0 rounded-lg border border-neutral-200 p-3 text-center"
                >
                  <p className="text-xs text-neutral-500">{DATE_FORMAT.format(new Date(`${day.date}T00:00:00Z`))}</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-neutral-900">
                    {EUR.format(day.price)}
                  </p>
                  {day.breakdown.length > 0 && (
                    <p className="mt-0.5 text-[10px] text-neutral-400">{day.breakdown.length} règle(s)</p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-400">Survole un jour pour voir le détail du calcul.</p>
          </div>
        )}
      </section>

      {selectedUnit && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Concurrence — {selectedUnit.name}</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Saisie manuelle — pas de scraping automatique (voir le dossier d&apos;architecture).
          </p>

          {compStats && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Moyenne" value={`${compStats.average.toFixed(0)} €`} />
              <Stat label="Médiane" value={`${compStats.median.toFixed(0)} €`} />
              <Stat label="Min" value={`${compStats.min.toFixed(0)} €`} />
              <Stat label="Max" value={`${compStats.max.toFixed(0)} €`} />
              {positioningPct != null && (
                <Stat
                  label="Mon positionnement"
                  value={`${positioningPct > 0 ? "+" : ""}${positioningPct.toFixed(1)} %`}
                  tone={positioningPct > 5 ? "warning" : positioningPct < -15 ? "warning" : "default"}
                />
              )}
            </div>
          )}

          <ul className="mt-4 space-y-2">
            {competitors.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-neutral-900">
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-emerald-700">
                        {c.name}
                      </a>
                    ) : (
                      c.name
                    )}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {c.platform || "Plateforme non renseignée"}
                    {c.latestPrice != null && ` · dernier prix connu : ${c.latestPrice.toFixed(0)} € (${c.latestDate})`}
                  </p>
                </div>
                {canManage && <LogPriceForm competitorId={c.id} orgSlug={org.slug} />}
              </li>
            ))}
            {competitors.length === 0 && (
              <p className="text-sm text-neutral-500">Aucun concurrent suivi pour ce logement.</p>
            )}
          </ul>

          {canManage && (
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <AddCompetitorForm unitId={selectedUnit.id} orgSlug={org.slug} />
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">Règles actives</h2>
        {allRules.length === 0 ? (
          <p className="text-sm text-neutral-500">Aucune règle pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {allRules.map((rule) => {
              const scopeUnit = unitList.find((u) => u.id === rule.unit_id);
              return (
                <li
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-neutral-900">{rule.label}</p>
                    <p className="text-xs text-neutral-500">
                      {RULE_TYPE_LABELS[rule.rule_type] ?? rule.rule_type} ·{" "}
                      {scopeUnit ? scopeUnit.name : "Toute l'organisation"} ·{" "}
                      {rule.adjustment_value > 0 ? "+" : ""}
                      {rule.adjustment_value}
                      {rule.adjustment_type === "percent" ? "%" : "€"} · priorité {rule.priority}
                    </p>
                  </div>
                  {canManage && <RuleActions ruleId={rule.id} orgSlug={org.slug} isActive={rule.is_active} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canManage && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Créer une règle</h2>
          <div className="mt-4">
            <CreateRuleForm orgId={org.id} orgSlug={org.slug} units={unitList} />
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-center ${
        tone === "warning" ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white"
      }`}
    >
      <p
        className={`text-lg font-semibold tabular-nums ${
          tone === "warning" ? "text-amber-700" : "text-neutral-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
    </div>
  );
}
