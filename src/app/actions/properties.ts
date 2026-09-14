"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type FormState = { error: string | null };

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createProperty(
  orgId: string,
  orgSlug: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData, "name");
  const addressLine1 = str(formData, "address_line1");
  const city = str(formData, "city");
  const postalCode = str(formData, "postal_code");

  if (!name || !addressLine1 || !city || !postalCode) {
    return { error: "Nom, adresse, ville et code postal sont obligatoires." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("properties").insert({
    organization_id: orgId,
    name,
    address_line1: addressLine1,
    address_line2: str(formData, "address_line2") || null,
    city,
    postal_code: postalCode,
    country: str(formData, "country") || "FR",
  });

  if (error) {
    return { error: "Impossible de créer le logement. Réessaie." };
  }

  revalidatePath(`/org/${orgSlug}/properties`);
  return { error: null };
}
