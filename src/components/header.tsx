import { authClient } from "@/lib/neon-auth";

export type AppView = "identify" | "log";

export function Header({
  view,
  onView,
  userEmail,
}: {
  view: AppView;
  onView: (view: AppView) => void;
  userEmail?: string;
}) {
  async function signOut() {
    await authClient.signOut();
  }

  return (
    <header className="mx-auto flex w-full max-w-5xl items-baseline justify-between gap-6 px-6 py-6">
      <button
        type="button"
        onClick={() => onView("identify")}
        className="font-display text-3xl tracking-tight text-ink"
      >
        Fieldmark
      </button>
      <nav className="flex items-baseline gap-5 text-[1.02rem]">
        <button
          type="button"
          onClick={() => onView("identify")}
          className={view === "identify" ? "text-moss" : "text-dusk hover:text-ink"}
        >
          Identify
        </button>
        <button
          type="button"
          onClick={() => onView("log")}
          className={view === "log" ? "text-moss" : "text-dusk hover:text-ink"}
        >
          Log
        </button>
        {userEmail ? (
          <button type="button" onClick={signOut} className="text-dusk hover:text-ink">
            Sign out
          </button>
        ) : null}
      </nav>
    </header>
  );
}
