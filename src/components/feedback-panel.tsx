import { useState, type FormEvent } from "react";
import { birdApi } from "@/lib/neon-auth";
import {
  feedbackMessageError,
  feedbackScreenshotError,
  MAX_FEEDBACK_LENGTH,
  normalizeFeedbackMessage,
} from "@/lib/feedback";

export function FeedbackPanel({ signedIn }: { signedIn: boolean }) {
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function chooseScreenshot(file: File | null) {
    setError(null);
    setSent(false);
    if (!file || file.size === 0) {
      setScreenshot(null);
      return;
    }
    const invalid = feedbackScreenshotError(file);
    if (invalid) {
      setScreenshot(null);
      setFileInputKey((value) => value + 1);
      setError(invalid);
      return;
    }
    setScreenshot(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSent(false);

    const invalid = feedbackMessageError(message);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!signedIn) {
      setError("Sign in below to send feedback.");
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.set("message", normalizeFeedbackMessage(message));
      if (screenshot) body.set("screenshot", screenshot);
      await birdApi.request("/feedback", { method: "POST", body });
      setMessage("");
      setScreenshot(null);
      setFileInputKey((value) => value + 1);
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not submit feedback.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 max-w-2xl">
      <form className="grid gap-5" onSubmit={submit}>
        <label className="grid gap-2">
          <span className="font-medium">What should we know?</span>
          <textarea
            required
            rows={6}
            maxLength={MAX_FEEDBACK_LENGTH}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="border border-ink/30 bg-paper px-3 py-2.5"
            placeholder="Tell us what happened, what worked, or what you would improve."
          />
          <span className="text-sm text-lichen">
            {message.length.toLocaleString()} / {MAX_FEEDBACK_LENGTH.toLocaleString()}
          </span>
        </label>

        <label className="grid gap-2">
          <span className="font-medium">Screenshot (optional)</span>
          <input
            key={fileInputKey}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              chooseScreenshot(event.target.files?.[0] ?? null)
            }
            className="border border-ink/25 bg-paper p-2"
          />
          <span className="text-sm text-lichen">
            JPEG, PNG, or WebP. Up to 8 MB.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy}
            className="bg-warbler px-5 py-2.5 text-ink disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send feedback"}
          </button>
          {!signedIn ? (
            <p className="text-dusk">Sign in below before sending.</p>
          ) : null}
        </div>

        {error ? (
          <p className="text-dusk" role="alert">
            {error}
          </p>
        ) : null}
        {sent ? (
          <p className="text-moss" role="status">
            Thank you — your feedback was sent.
          </p>
        ) : null}
      </form>
    </section>
  );
}
