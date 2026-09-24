import { describe, expect, it } from "vitest";
import { canGenerateBird } from "./bird-generation";

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
