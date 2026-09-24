import { CORNELL_LAB_DONATE_URL } from "@/lib/cornell-support";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-6 pb-10 pt-4 text-[0.98rem] leading-relaxed text-lichen">
      <p className="max-w-2xl">
        Fieldmark is a toy. If you are serious about birding, the Cornell Lab of
        Ornithology — Merlin, eBird, and the research behind them — is the real
        thing.{" "}
        <a
          href={CORNELL_LAB_DONATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-moss underline decoration-moss/40 underline-offset-3 hover:text-ink"
        >
          They accept donations.
        </a>
      </p>
    </footer>
  );
}
