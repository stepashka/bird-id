import { describe, expect, it } from "vitest";
import { parseIdentification, parseIdentificationJson } from "../lib/identification";
import { generatedObjectKeyForUser, validateImageUpload } from "../lib/image";

describe("validateImageUpload", () => {
  it("rejects empty files", () => {
    expect(
      validateImageUpload({ bytes: new Uint8Array(), contentType: "image/jpeg" })?.code,
    ).toBe("missing");
  });

  it("rejects unsupported types", () => {
    expect(
      validateImageUpload({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/gif" })
        ?.code,
    ).toBe("unsupported_type");
  });

  it("accepts jpeg photos", () => {
    expect(
      validateImageUpload({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" }),
    ).toBeNull();
  });
});

describe("generatedObjectKeyForUser", () => {
  it("creates a private generated JPEG key with a safe user segment", () => {
    expect(generatedObjectKeyForUser("user/one")).toMatch(
      /^generated\/user_one\/[0-9a-f-]+\.jpg$/,
    );
  });
});

describe("parseIdentification", () => {
  it("reads camelCase fields", () => {
    expect(
      parseIdentification({
        commonName: "American Robin",
        scientificName: "Turdus migratorius",
        confidence: 0.86,
      }),
    ).toEqual({
      commonName: "American Robin",
      scientificName: "Turdus migratorius",
      confidence: 0.86,
      alternatives: [],
      evidence: [],
    });
  });

  it("reads snake_case JSON from a model reply", () => {
    expect(
      parseIdentificationJson(
        'Here you go\n{"common_name":"Blue Jay","scientific_name":"Cyanocitta cristata","confidence":"0.7"}',
      ),
    ).toEqual({
      commonName: "Blue Jay",
      scientificName: "Cyanocitta cristata",
      confidence: 0.7,
      alternatives: [],
      evidence: [],
    });
  });

  it("rejects unnamed birds", () => {
    expect(() =>
      parseIdentification({ commonName: "", scientificName: "", confidence: 1 }),
    ).toThrow(/did not name/);
  });

  it("keeps close alternatives and visible evidence", () => {
    expect(
      parseIdentification({
        commonName: "European Goldfinch",
        scientificName: "Carduelis carduelis",
        confidence: 0.72,
        alternatives: ["Eurasian Siskin", "House Sparrow"],
        evidence: ["red face", "yellow wing bar", "conical bill"],
      }),
    ).toEqual({
      commonName: "European Goldfinch",
      scientificName: "Carduelis carduelis",
      confidence: 0.72,
      alternatives: ["Eurasian Siskin", "House Sparrow"],
      evidence: ["red face", "yellow wing bar", "conical bill"],
    });
  });
});
