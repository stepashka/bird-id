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
  return new URL(location.pathname, location.origin).toString();
}

export function sharedPageState(input: SharedPageInput) {
  if (input.loading) return { kind: "loading" } as const;
  if (input.error || !input.sighting) return { kind: "unavailable" } as const;
  return { kind: "ready", sighting: input.sighting } as const;
}
