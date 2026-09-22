import { useState } from "react";
import { AuthPanel } from "@/components/auth-panel";
import { Header, type AppView } from "@/components/header";
import { HistoryPanel } from "@/components/history-panel";
import { IdentifyPanel } from "@/components/identify-panel";
import { authClient } from "@/lib/neon-auth";

export default function App() {
  const [view, setView] = useState<AppView>("identify");
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  return (
    <>
      <Header view={view} onView={setView} userEmail={user?.email} />

      {view === "log" ? (
        user ? (
          <HistoryPanel userId={user.id} />
        ) : (
          <main className="mx-auto w-full max-w-3xl px-6 pb-20">
            <h1 className="font-display text-5xl">Your log</h1>
            {isPending ? (
              <p className="mt-8 text-lichen">Checking your session…</p>
            ) : (
              <AuthPanel />
            )}
          </main>
        )
      ) : (
        <main className="mx-auto w-full max-w-5xl px-6 pb-20">
          <p className="max-w-xl text-[1.15rem] leading-relaxed text-dusk">
            Photograph a bird. Fieldmark names the species and files it with the
            rest of your identifications.
          </p>
          {isPending ? (
            <p className="mt-10 text-lichen">Checking your session…</p>
          ) : user ? (
            <div className="mt-8">
              <IdentifyPanel signedIn />
            </div>
          ) : (
            <AuthPanel />
          )}
        </main>
      )}
    </>
  );
}
