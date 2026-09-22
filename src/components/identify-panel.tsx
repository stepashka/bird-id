"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SightingResult, type Sighting } from "@/components/sighting";
import { authClient } from "@/lib/auth/client";

export function IdentifyPanel() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sighting, setSighting] = useState<Sighting | null>(null);

  function onFile(next: File | null) {
    setError(null);
    setSighting(null);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  }

  async function onIdentify() {
    if (!file) {
      setError("Choose a photo of the bird.");
      return;
    }
    if (!session?.user) {
      router.push("/auth/sign-in");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("photo", file);
      const response = await fetch("/api/identify", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Identification failed.");
        return;
      }
      setSighting({
        id: payload.id,
        commonName: payload.commonName,
        scientificName: payload.scientificName,
        confidence: payload.confidence,
        createdAt: payload.createdAt,
        photoUrl: payload.photoUrl,
      });
    } catch {
      setError("Could not reach the identification service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        className="block cursor-pointer border border-dashed border-ink/35 bg-paper/80 p-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onFile(event.dataTransfer.files[0] ?? null);
        }}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Selected bird photo"
            className="max-h-[28rem] w-full object-contain"
          />
        ) : (
          <div className="flex min-h-[18rem] flex-col justify-between px-2 py-3">
            <p className="font-display text-4xl leading-tight">
              Lay the photo here, as you would a specimen on the light table.
            </p>
            <p className="max-w-md text-dusk">
              JPEG, PNG, or WebP. One bird, as clear as you can get.
            </p>
          </div>
        )}
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onIdentify}
          disabled={busy || isPending}
          className="bg-warbler px-5 py-2.5 text-ink disabled:opacity-50"
        >
          {busy ? "Looking…" : "Identify bird"}
        </button>
        {!isPending && !session?.user ? (
          <p className="text-dusk">
            Sign in first so this stays in your log.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-dusk" role="alert">
          {error}
        </p>
      ) : null}

      {sighting ? <SightingResult sighting={sighting} /> : null}
    </div>
  );
}
