import { describe, expect, it } from "vitest";
import {
  canGenerateBird,
  identificationStartState,
} from "./bird-generation";

describe("canGenerateBird", () => {
  it("allows an untouched Not a bird result", () => {
    expect(
      canGenerateBird({
        commonName: "Not a bird",
        scientificName: "n/a",
      }),
    ).toBe(true);
  });

  it("rejects generated results", () => {
    expect(
      canGenerateBird({
        isGenerated: true,
        commonName: "Not a bird",
        scientificName: "n/a",
      }),
    ).toBe(false);
  });

  it("rejects a source that already has a generated child", () => {
    expect(
      canGenerateBird({
        hasGeneratedChild: true,
        commonName: "Not a bird",
        scientificName: "n/a",
      }),
    ).toBe(false);
  });
});

describe("identificationStartState", () => {
  it("clears a previous fictional result when identification runs again", () => {
    const sighting = {
      id: "source-2",
      commonName: "Not a bird",
      scientificName: "n/a",
      confidence: 1,
      createdAt: "2026-09-24T13:00:00.000Z",
      photoUrl: "https://signed.example/source-2",
    };

    expect(identificationStartState(sighting)).toEqual({
      sighting,
      generatedSighting: null,
    });
  });
});
