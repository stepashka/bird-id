import { useEffect, useState } from "react";
import { SightingResult } from "@/components/sighting";
import { publicBirdApi } from "@/lib/neon-auth";
import { sharedPageState } from "@/lib/shared-page";
import type { Sighting } from "@/lib/sighting";

export function SharedIdentificationPage({ token }: { token: string }) {
  const [sighting, setSighting] = useState<Sighting>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    publicBirdApi
      .request<Sighting>(`/shares/${encodeURIComponent(token)}`)
      .then((value) => {
        if (active) setSighting(value);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const state = sharedPageState({ loading, error, sighting });
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="font-display text-2xl">Fieldmark</p>
      {state.kind === "loading" ? (
        <p className="mt-10 text-lichen">Loading identification…</p>
      ) : state.kind === "unavailable" ? (
        <p className="mt-10 text-dusk">
          This shared identification is unavailable.
        </p>
      ) : (
        <SightingResult sighting={state.sighting} publicView />
      )}
    </main>
  );
}
