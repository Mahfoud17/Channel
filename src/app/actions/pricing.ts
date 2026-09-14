"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/reservations";

const RULE_TYPES = ["weekend", "occupancy_high", "occupancy_low", "length_of_stay", "last_minute"] as const;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableInt(formData: FormData, key: string): number | null {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : null;
}

export async function createPricingRule(
  organizationId: string,
  orgSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const ruleType = str(formData, "rule_type");
  if (!RULE_TYPES.includes(ruleType as (typeof RULE_TYPES)[number])) {
    return { error: "Type de règle invalide." };
  }

  const label = str(formData, "label");
  const adjustmentValue = Number(str(formData, "adjustment_value"));
  if (!label || !Number.isFinite(adjustmentValue)) {
    return { error: "Le libellé et la valeur d'ajustement sont obligatoires." };
  }

  const unitId = str(formData, "unit_id") || null;

  const supabase = await createClient();
  const { error } = await supabase.from("pricing_rules").insert({
    organization_id: organizationId,
    unit_id: unitId,
    rule_type: ruleType,
    label,
    lookahead_days: nullableInt(formData, "lookahead_days"),
    occupancy_threshold_pct: nullableInt(formData, "occupancy_threshold_pct"),
    min_nights: nullableInt(formData, "min_nights"),
    max_nights: nullableInt(formData, "max_nights"),
    days_before_checkin_max: nullableInt(formData, "days_before_checkin_max"),
    adjustment_type: str(formData, "adjustment_type") || "percent",
    adjustment_value: adjustmentValue,
    priority: nullableInt(formData, "priority") ?? 0,
  });

  if (error) {
    return { error: "Impossible de créer cette règle." };
  }

  revalidatePath(`/org/${orgSlug}/pricing`);
  return { error: null };
}

export async function deletePricingRule(ruleId: string, orgSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pricing_rules").delete().eq("id", ruleId);

  revalidatePath(`/org/${orgSlug}/pricing`);
  if (error) return { error: "Impossible de supprimer cette règle." };
  return { error: null };
}

export async function togglePricingRule(ruleId: string, orgSlug: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pricing_rules")
    .update({ is_active: isActive })
    .eq("id", ruleId);

  revalidatePath(`/org/${orgSlug}/pricing`);
  if (error) return { error: "Impossible de mettre à jour cette règle." };
  return { error: null };
}
