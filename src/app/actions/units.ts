"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/properties";

const UNIT_TYPES = ["appartement", "studio", "maison", "chambre", "autre"] as const;
const UNIT_STATUSES = ["active", "inactive", "maintenance"] as const;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function int(formData: FormData, key: string, fallback: number): number {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function nullableFloat(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function createUnit(
  propertyId: string,
  orgSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData, "name");
  if (!name) {
    return { error: "Le nom de l'unité est obligatoire." };
  }

  const unitType = UNIT_TYPES.includes(str(formData, "unit_type") as (typeof UNIT_TYPES)[number])
    ? str(formData, "unit_type")
    : "appartement";

  const supabase = await createClient();
  const { error } = await supabase.from("units").insert({
    property_id: propertyId,
    name,
    unit_type: unitType,
    bedrooms: int(formData, "bedrooms", 1),
    beds: int(formData, "beds", 1),
    max_guests: int(formData, "max_guests", 2),
  });

  if (error) {
    return { error: "Impossible de créer l'unité. Réessaie." };
  }

  revalidatePath(`/org/${orgSlug}/properties/${propertyId}`);
  return { error: null };
}

export async function updateUnitDetails(
  unitId: string,
  propertyId: string,
  orgSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData, "name");
  if (!name) {
    return { error: "Le nom de l'unité est obligatoire." };
  }

  const amenities = str(formData, "amenities")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const basePrice = nullableFloat(formData, "base_price");
  const minPrice = nullableFloat(formData, "min_price");
  const maxPrice = nullableFloat(formData, "max_price");
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    return { error: "Le prix minimum ne peut pas dépasser le prix maximum." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .update({
      name,
      bedrooms: int(formData, "bedrooms", 1),
      beds: int(formData, "beds", 1),
      max_guests: int(formData, "max_guests", 2),
      has_elevator: formData.get("has_elevator") === "on",
      has_parking: formData.get("has_parking") === "on",
      amenities,
      access_instructions: str(formData, "access_instructions") || null,
      keybox_code: str(formData, "keybox_code") || null,
      wifi_ssid: str(formData, "wifi_ssid") || null,
      wifi_password: str(formData, "wifi_password") || null,
      base_price: basePrice,
      min_price: minPrice,
      max_price: maxPrice,
    })
    .eq("id", unitId);

  if (error) {
    return { error: "Impossible d'enregistrer les modifications." };
  }

  revalidatePath(`/org/${orgSlug}/units/${unitId}`);
  revalidatePath(`/org/${orgSlug}/properties/${propertyId}`);
  return { error: null };
}

export async function archiveUnit(unitId: string, propertyId: string, orgSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", unitId);

  revalidatePath(`/org/${orgSlug}/properties/${propertyId}`);
  revalidatePath(`/org/${orgSlug}/units/${unitId}`);

  if (error) {
    return { error: "Impossible de supprimer l'unité." };
  }
  return { error: null };
}

export async function updateUnitStatus(
  unitId: string,
  propertyId: string,
  orgSlug: string,
  status: string,
) {
  if (!UNIT_STATUSES.includes(status as (typeof UNIT_STATUSES)[number])) {
    return { error: "Statut invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("units").update({ status }).eq("id", unitId);

  if (error) {
    return { error: "Impossible de changer le statut." };
  }

  revalidatePath(`/org/${orgSlug}/units/${unitId}`);
  revalidatePath(`/org/${orgSlug}/properties/${propertyId}`);
  return { error: null };
}

export async function deleteUnitPhoto(
  photoId: string,
  storagePath: string,
  unitId: string,
  orgSlug: string,
) {
  const supabase = await createClient();

  // Remove the DB row and the underlying object; if either fails we still
  // want the other cleaned up eventually, so we don't short-circuit — but
  // we do report the first error.
  const [{ error: dbError }, { error: storageError }] = await Promise.all([
    supabase.from("unit_photos").delete().eq("id", photoId),
    supabase.storage.from("unit-photos").remove([storagePath]),
  ]);

  revalidatePath(`/org/${orgSlug}/units/${unitId}`);

  if (dbError || storageError) {
    return { error: "Suppression partielle de la photo — réessaie si elle réapparaît." };
  }
  return { error: null };
}

export async function attachUnitPhoto(unitId: string, orgSlug: string, storagePath: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("unit_photos").insert({
    unit_id: unitId,
    storage_path: storagePath,
  });

  revalidatePath(`/org/${orgSlug}/units/${unitId}`);

  if (error) {
    // Uploaded object would be orphaned without a DB row — clean it up.
    await supabase.storage.from("unit-photos").remove([storagePath]);
    return { error: "Impossible d'enregistrer la photo." };
  }
  return { error: null };
}
