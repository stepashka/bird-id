import { confidenceLabel, type Sighting } from "@/lib/sighting";

export function SightingResult({
  sighting,
  layout = "hero",
}: {
  sighting: Sighting;
  layout?: "hero" | "row";
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
          className="h-24 w-[7.5rem] object-cover"
        />
        <div>
          <h2 className="font-display text-[1.85rem] leading-none">
            {sighting.commonName}
          </h2>
          <p className="mt-1 italic text-dusk">{sighting.scientificName}</p>
          <p className="mt-3 text-lichen">
            {confidenceLabel(sighting.confidence)} · {date}
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="mt-10 grid gap-6 md:grid-cols-[minmax(0,18rem)_1fr] md:items-end">
      <img
        src={sighting.photoUrl}
        alt={sighting.commonName}
        className="w-full object-cover"
      />
      <div>
        <h2 className="font-display text-5xl leading-[0.95]">
          {sighting.commonName}
        </h2>
        <p className="mt-2 text-xl italic text-dusk">{sighting.scientificName}</p>
        <p className="mt-4 text-lichen">
          {confidenceLabel(sighting.confidence)} · {date}
        </p>
      </div>
    </article>
  );
}
