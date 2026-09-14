"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { attachUnitPhoto, deleteUnitPhoto } from "@/app/actions/units";

type Photo = { id: string; storage_path: string; url: string };

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PhotoManager({
  unitId,
  orgId,
  orgSlug,
  initialPhotos,
}: {
  unitId: string;
  orgId: string;
  orgSlug: string;
  initialPhotos: Photo[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formats acceptés : JPEG, PNG, WebP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Fichier trop lourd (8 Mo max).");
      return;
    }

    setIsUploading(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop() ?? "jpg";
    const storagePath = `${orgId}/${unitId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("unit-photos")
      .upload(storagePath, file, { contentType: file.type });

    if (uploadError) {
      setIsUploading(false);
      setError("Échec de l'envoi. Réessaie.");
      return;
    }

    const result = await attachUnitPhoto(unitId, orgSlug, storagePath);
    setIsUploading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    const { data } = supabase.storage.from("unit-photos").getPublicUrl(storagePath);
    // Optimistic append — attachUnitPhoto also revalidates the page, but
    // this shows the photo immediately without waiting for that round trip.
    setPhotos((current) => [
      ...current,
      { id: storagePath, storage_path: storagePath, url: data.publicUrl },
    ]);
  }

  function handleDelete(photo: Photo) {
    setPhotos((current) => current.filter((p) => p.storage_path !== photo.storage_path));
    startTransition(() => {
      deleteUnitPhoto(photo.id, photo.storage_path, unitId, orgSlug);
    });
  }

  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.storage_path}
              className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
            >
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="200px"
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => handleDelete(photo)}
                disabled={isPending}
                aria-label="Supprimer la photo"
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-60"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
        >
          {isUploading ? "Envoi en cours…" : "Ajouter une photo"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
