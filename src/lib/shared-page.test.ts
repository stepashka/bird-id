import { describe, expect, it } from "vitest";
import type { Sighting } from "./sighting";
import { sharedPageState } from "./shared-page";

const sighting = {} as Sighting;

describe("sharedPageState", () => {
  it("selects loading, unavailable, and ready states", () => {
    expect(sharedPageState({ loading: true })).toEqual({ kind: "loading" });
    expect(sharedPageState({ error: true })).toEqual({ kind: "unavailable" });
    expect(sharedPageState({ sighting })).toEqual({ kind: "ready", sighting });
  });
});
