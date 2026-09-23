import { formatLocalizedNames } from "../../lib/bird-names";
import { googleImagesUrl } from "@/lib/google-images";
import { confidenceLabel, type Sighting } from "@/lib/sighting";
import { wikipediaUrl } from "@/lib/wikipedia";
import type { ReactNode } from "react";

export function SightingResult({
  sighting,
  layout = "hero",
  actions,
  publicView = false,
}: {
  sighting: Sighting;
  layout?: "hero" | "row";
  actions?: ReactNode;
  publicView?: boolean;
}) {
  const date = new Date(sighting.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (layout === "row") {
    return (
      <article className="grid grid-cols-[7.5rem_1fr] gap-5 border-t border-ink/15 py-6 first:border-t-0 first:pt-0">
        <img
          src={sighting.photoUrl}
          alt={sighting.commonName}
          referrerPolicy={publicView ? "no-referrer" : undefined}
          className="h-24 w-[7.5rem] object-cover"
        />
        <div>
          <h2 className="font-display text-[1.85rem] leading-none">
            {sighting.commonName}
          </h2>
          <p className="mt-1 italic text-dusk">{sighting.scientificName}</p>
          <LocalizedNameList names={sighting.names} />
          <p className="mt-3 text-lichen">
            {confidenceLabel(sighting.confidence)} · {date}
          </p>
          <SightingNotes sighting={sighting} />
          <SightingLinks sighting={sighting} publicView={publicView} />
          {actions}
        </div>
      </article>
    );
  }

  return (
    <article className="mt-10 grid gap-6 md:grid-cols-[minmax(0,18rem)_1fr] md:items-end">
      <img
        src={sighting.photoUrl}
        alt={sighting.commonName}
        referrerPolicy={publicView ? "no-referrer" : undefined}
        className="w-full object-cover"
      />
      <div>
        <h2 className="font-display text-5xl leading-[0.95]">
          {sighting.commonName}
        </h2>
        <p className="mt-2 text-xl italic text-dusk">{sighting.scientificName}</p>
        <LocalizedNameList names={sighting.names} />
        <p className="mt-4 text-lichen">
          {confidenceLabel(sighting.confidence)} · {date}
        </p>
        <SightingNotes sighting={sighting} />
        <SightingLinks sighting={sighting} publicView={publicView} />
        {actions}
      </div>
    </article>
  );
}

function LocalizedNameList({ names }: { names: Sighting["names"] }) {
  const lines = formatLocalizedNames(names);
  if (lines.length === 0) return null;
  return (
    <ul className="mt-3 max-w-md text-dusk">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function SightingLinks({
  sighting,
  publicView,
}: {
  sighting: Sighting;
  publicView: boolean;
}) {
  const imagesUrl = googleImagesUrl(sighting.names?.en ?? sighting.commonName);

  return (
    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      <a
        className="text-moss underline underline-offset-4"
        href={wikipediaUrl(sighting.scientificName, navigator.language)}
        target="_blank"
        rel="noreferrer"
        referrerPolicy={publicView ? "no-referrer" : undefined}
      >
        View on Wikipedia
      </a>
      {imagesUrl ? (
        <a
          className="text-moss underline underline-offset-4"
          href={imagesUrl}
          target="_blank"
          rel="noreferrer"
          referrerPolicy={publicView ? "no-referrer" : undefined}
        >
          Google Images
        </a>
      ) : null}
    </p>
  );
}

function SightingNotes({ sighting }: { sighting: Sighting }) {
  const evidence = sighting.evidence?.filter(Boolean) ?? [];
  const alternatives = sighting.alternatives?.filter(Boolean) ?? [];
  if (evidence.length === 0 && alternatives.length === 0) return null;

  return (
    <div className="mt-3 max-w-md text-dusk">
      {evidence.length > 0 ? <p>Seen: {evidence.join(", ")}</p> : null}
      {alternatives.length > 0 ? (
        <p className="mt-1">Also possible: {alternatives.join(", ")}</p>
      ) : null}
    </div>
  );
}
