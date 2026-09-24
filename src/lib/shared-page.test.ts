import { describe, expect, it } from "vitest";
import type { Sighting } from "./sighting";
import {
  sharedPageHomeHref,
  sharedPageState,
  sharedPageViewHref,
} from "./shared-page";

const sighting = {} as Sighting;

describe("sharedPageState", () => {
  it("selects loading, unavailable, and ready states", () => {
    expect(sharedPageState({ loading: true })).toEqual({ kind: "loading" });
    expect(sharedPageState({ error: true })).toEqual({ kind: "unavailable" });
    expect(sharedPageState({ sighting })).toEqual({ kind: "ready", sighting });
  });
});

describe("sharedPageHomeHref", () => {
  it("returns the app path without the share token", () => {
    expect(
      sharedPageHomeHref({
        origin: "https://stepashka.github.io",
        pathname: "/bird-id/",
      }),
    ).toBe("https://stepashka.github.io/bird-id/");
  });

  it("builds main-app navigation without retaining the share token", () => {
    const location = {
      origin: "https://stepashka.github.io",
      pathname: "/bird-id/",
    };

    expect(sharedPageViewHref(location, "identify")).toBe(
      "https://stepashka.github.io/bird-id/",
    );
    expect(sharedPageViewHref(location, "log")).toBe(
      "https://stepashka.github.io/bird-id/?view=log",
    );
    expect(sharedPageViewHref(location, "feedback")).toBe(
      "https://stepashka.github.io/bird-id/?view=feedback",
    );
  });
});
