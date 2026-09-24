import { useState } from "react";
import { AuthPanel } from "@/components/auth-panel";
import { FeedbackPanel } from "@/components/feedback-panel";
import { Header, type AppView } from "@/components/header";
import { HistoryPanel } from "@/components/history-panel";
import { IdentifyPanel } from "@/components/identify-panel";
import { SharedIdentificationPage } from "@/components/shared-identification-page";
import { authClient } from "@/lib/neon-auth";
import { readShareToken } from "@/lib/share-link";

export default function App() {
  const shareToken = readShareToken(window.location.search);
  if (shareToken) return <SharedIdentificationPage token={shareToken} />;
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [view, setView] = useState<AppView>("identify");
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  return (
    <>
      <Header view={view} onView={setView} userEmail={user?.email} />

      {view === "feedback" ? (
        <main className="mx-auto w-full max-w-5xl px-6 pb-20">
          <h1 className="font-display text-5xl">Feedback</h1>
          <p className="mt-3 max-w-xl text-[1.15rem] leading-relaxed text-dusk">
            Found something confusing, delightful, or broken? Send a short note
            and, if useful, a screenshot.
          </p>
          <FeedbackPanel signedIn={Boolean(user)} />
          {!isPending && !user ? <AuthPanel /> : null}
        </main>
      ) : view === "log" ? (
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
