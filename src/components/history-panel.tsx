import { useEffect, useState } from "react";
import { SightingResult } from "@/components/sighting";
import { ShareControls } from "@/components/share-controls";
import { birdApi } from "@/lib/neon-auth";
import type { Sighting } from "@/lib/sighting";

export function HistoryPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<Sighting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    birdApi
      .request<{ items: Sighting[] }>("/history")
      .then((payload) => {
        if (active) setItems(payload.items);
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Could not load history.",
          );
        }
      })
      .finally(() => {
        if (active) setLoadedForUser(userId);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const loading = loadedForUser !== userId;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-12">
      <h1 className="font-display text-5xl">Your log</h1>
      <p className="mt-3 max-w-lg text-dusk">
        Identifications stay on your account. Newest first.
      </p>

      {loading ? (
        <p className="mt-10 text-lichen">Loading the log…</p>
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
            <SightingResult
              key={item.id}
              sighting={item}
              layout="row"
              actions={
                <ShareControls
                  sighting={item}
                  onSharedChange={(shared) =>
                    setItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, shared } : entry,
                      ),
                    )
                  }
                />
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
