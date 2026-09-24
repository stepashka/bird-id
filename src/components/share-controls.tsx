import { useState } from "react";
import { birdApi } from "@/lib/neon-auth";
import {
  ownerShareUrl,
  shareLink,
  shareMessage,
  type ShareOutcome,
} from "@/lib/share-link";
import type { Sighting } from "@/lib/sighting";

export function ShareControls({
  sighting,
  onSharedChange,
}: {
  sighting: Sighting;
  onSharedChange: (shared: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createShare() {
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      const { url: nextUrl } = await birdApi.request<{ url: string }>(
        `/identifications/${sighting.id}/shares`,
        { method: "POST" },
      );
      setUrl(nextUrl);
      const nextOutcome = await shareLink({
        url: nextUrl,
        title: sighting.commonName,
        share: navigator.share?.bind(navigator),
        writeText: navigator.clipboard?.writeText.bind(navigator.clipboard),
      });
      setOutcome(nextOutcome);
      onSharedChange(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not share.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeShares() {
    setBusy(true);
    setError(null);
    try {
      await birdApi.request(`/identifications/${sighting.id}/shares`, {
        method: "DELETE",
      });
      setOutcome(null);
      setUrl("");
      onSharedChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not revoke.");
    } finally {
      setBusy(false);
    }
  }

  const message = outcome ? shareMessage(outcome) : null;
  const visibleUrl = ownerShareUrl(url);

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={busy}
        onClick={sighting.shared ? revokeShares : createShare}
        className="text-moss underline underline-offset-4 disabled:opacity-50"
      >
        {busy
          ? "Working…"
          : sighting.shared
            ? "Revoke shared links"
            : "Share identification"}
      </button>
      {message ? <p className="mt-2 text-dusk">{message}</p> : null}
      {visibleUrl ? (
        <input
          className="mt-2 w-full border border-ink/25 bg-paper p-2"
          value={visibleUrl}
          readOnly
          aria-label="Share link"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
      {error ? <p className="mt-2 text-dusk" role="alert">{error}</p> : null}
    </div>
  );
}
