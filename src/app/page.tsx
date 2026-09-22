import { IdentifyPanel } from "@/components/identify-panel";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-20">
      <p className="max-w-xl text-[1.15rem] leading-relaxed text-dusk">
        Photograph a bird. Fieldmark names the species and files it with the rest
        of your identifications.
      </p>
      <div className="mt-8">
        <IdentifyPanel />
      </div>
    </main>
  );
}
