import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { SightingResult } from "@/components/sighting";
import type { AppView } from "@/lib/app-view";
import { authClient, publicBirdApi } from "@/lib/neon-auth";
import { sharedPageState, sharedPageViewHref } from "@/lib/shared-page";
import type { Sighting } from "@/lib/sighting";

export function SharedIdentificationPage({ token }: { token: string }) {
  const [sighting, setSighting] = useState<Sighting>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { data: session } = authClient.useSession();

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

  function navigateToApp(view: AppView) {
    window.location.assign(sharedPageViewHref(window.location, view));
  }

  return (
    <>
      <Header onView={navigateToApp} userEmail={session?.user.email} />
      <main className="mx-auto w-full max-w-5xl px-6 pb-20">
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
    </>
  );
}
