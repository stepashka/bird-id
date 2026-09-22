import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/neon-auth";

type Mode = "sign-in" | "sign-up";

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({
              email,
              password,
              name: name || email.split("@")[0] || "Birder",
            })
          : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? "Authentication failed.");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 max-w-lg border-t border-ink/20 pt-8">
      <h2 className="font-display text-4xl">
        {mode === "sign-in" ? "Open your field log" : "Start a field log"}
      </h2>
      <p className="mt-2 text-dusk">
        {mode === "sign-in"
          ? "Sign in before identifying a bird."
          : "Your sightings stay attached to this account."}
      </p>

      <form className="mt-6 grid gap-4" onSubmit={submit}>
        {mode === "sign-up" ? (
          <label className="grid gap-1.5">
            <span>Name</span>
            <input
              name="name"
              autoComplete="name"
              className="border border-ink/30 bg-paper px-3 py-2.5"
            />
          </label>
        ) : null}
        <label className="grid gap-1.5">
          <span>Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="border border-ink/30 bg-paper px-3 py-2.5"
          />
        </label>
        <label className="grid gap-1.5">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={8}
            required
            className="border border-ink/30 bg-paper px-3 py-2.5"
          />
        </label>

        {error ? (
          <p className="text-dusk" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy}
            className="bg-warbler px-5 py-2.5 text-ink disabled:opacity-50"
          >
            {busy
              ? "Working…"
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
          </button>
          <button
            type="button"
            className="text-dusk underline underline-offset-4"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setError(null);
            }}
          >
            {mode === "sign-in" ? "Create an account" : "I have an account"}
          </button>
        </div>
      </form>
    </section>
  );
}
