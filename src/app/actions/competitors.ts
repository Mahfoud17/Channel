"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/reservations";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableInt(formData: FormData, key: string): number | null {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : null;
}

export async function createCompetitor(
  unitId: string,
  orgSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData, "name");
  if (!name) {
    return { error: "Le nom du concurrent est obligatoire." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("competitors").insert({
    unit_id: unitId,
    name,
    platform: str(formData, "platform") || null,
    url: str(formData, "url") || null,
    bedrooms: nullableInt(formData, "bedrooms"),
    max_guests: nullableInt(formData, "max_guests"),
  });

  if (error) {
    return { error: "Impossible d'ajouter ce concurrent." };
  }

  revalidatePath(`/org/${orgSlug}/pricing`);
  return { error: null };
}

export async function deleteCompetitor(competitorId: string, orgSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("competitors").delete().eq("id", competitorId);

  revalidatePath(`/org/${orgSlug}/pricing`);
  if (error) return { error: "Impossible de supprimer ce concurrent." };
  return { error: null };
}

export async function addCompetitorPrice(
  competitorId: string,
  orgSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const observedDate = str(formData, "observed_date");
  const price = Number(str(formData, "price"));

  if (!observedDate || !Number.isFinite(price) || price < 0) {
    return { error: "Date et prix valides obligatoires." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("competitor_prices").upsert(
    { competitor_id: competitorId, observed_date: observedDate, price },
    { onConflict: "competitor_id,observed_date" },
  );

  if (error) {
    return { error: "Impossible d'enregistrer ce prix." };
  }

  revalidatePath(`/org/${orgSlug}/pricing`);
  return { error: null };
}
