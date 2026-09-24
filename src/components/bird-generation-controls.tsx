import { useState } from "react";
import { canGenerateBird } from "@/lib/bird-generation";
import { birdApi } from "@/lib/neon-auth";
import type { Sighting } from "@/lib/sighting";

export function BirdGenerationControls({
  sighting,
  onGenerated,
}: {
  sighting: Sighting;
  onGenerated: (generated: Sighting) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canGenerateBird(sighting)) return null;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const generated = await birdApi.request<Sighting>(
        `/identifications/${encodeURIComponent(sighting.id)}/make-bird`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim() || undefined }),
        },
      );
      onGenerated(generated);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn’t grow feathers this time. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-l-2 border-warbler pl-4">
      <label className="block max-w-md text-sm text-dusk">
        Any special direction? (optional)
        <input
          value={prompt}
          maxLength={200}
          disabled={busy}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="For example: iridescent blue plumage"
          className="mt-2 w-full border border-ink/25 bg-paper px-3 py-2 text-ink disabled:opacity-60"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={generate}
        className="mt-3 bg-warbler px-4 py-2 text-ink disabled:opacity-50"
      >
        {busy ? "Growing feathers…" : "Make it bird-like"}
      </button>
      {error ? (
        <p className="mt-2 text-dusk" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
