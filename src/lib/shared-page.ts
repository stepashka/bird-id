import type { AppView } from "./app-view";
import type { Sighting } from "./sighting";

type SharedPageInput = {
  loading?: boolean;
  error?: boolean;
  sighting?: Sighting;
};

export function sharedPageHomeHref(location: {
  origin: string;
  pathname: string;
}) {
  return sharedPageViewHref(location, "identify");
}

export function sharedPageViewHref(
  location: { origin: string; pathname: string },
  view: AppView,
) {
  const url = new URL(location.pathname, location.origin);
  if (view !== "identify") {
    url.searchParams.set("view", view);
  }
  return url.toString();
}

export function sharedPageState(input: SharedPageInput) {
  if (input.loading) return { kind: "loading" } as const;
  if (input.error || !input.sighting) return { kind: "unavailable" } as const;
  return { kind: "ready", sighting: input.sighting } as const;
}
