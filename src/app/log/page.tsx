"use client";

import { useEffect, useState } from "react";
import { SightingResult, type Sighting } from "@/components/sighting";
import { authClient } from "@/lib/auth/client";

export default function LogPage() {
  const { data: session, isPending } = authClient.useSession();
  const [items, setItems] = useState<Sighting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    if (isPending || !userId) return;

    fetch("/api/history")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Could not load history.");
          return;
        }
        setItems(payload.items ?? []);
      })
      .catch(() => setError("Could not load history."))
      .finally(() => setLoadedForUser(userId));
  }, [isPending, session?.user]);

  const loading =
    isPending || (!!session?.user && loadedForUser !== session.user.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-20">
      <h1 className="font-display text-5xl">Your log</h1>
      <p className="mt-3 max-w-lg text-dusk">
        Identifications stay on your account. Newest first.
      </p>

      {loading ? (
        <p className="mt-10 text-lichen">Loading the log…</p>
      ) : !session?.user ? (
        <p className="mt-10 text-dusk">Sign in to see birds you have already named.</p>
      ) : error ? (
        <p className="mt-10 text-dusk" role="alert">
          {error}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-10 text-dusk">
          Nothing here yet. Identify a photo and it will show up in this list.
        </p>
      ) : (
        <div className="mt-10">
          {items.map((item) => (
            <SightingResult key={item.id} sighting={item} layout="row" />
          ))}
        </div>
      )}
    </main>
  );
}
