import { describe, expect, it } from "vitest";
import {
  createShareToken,
  hashShareToken,
  isValidShareToken,
  toPublicSighting,
  type SharedIdentificationRow,
} from "./sharing";

describe("share tokens", () => {
  it("creates an unguessable base64url token", () => {
    const token = createShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isValidShareToken(token)).toBe(true);
  });

  it("hashes a token deterministically without retaining it", () => {
    const token = "a".repeat(43);
    expect(hashShareToken(token)).toHaveLength(64);
    expect(hashShareToken(token)).toBe(hashShareToken(token));
    expect(hashShareToken(token)).not.toContain(token);
  });
});

it("allowlists fields returned by the public endpoint", () => {
  expect(
    toPublicSighting(
      {
        id: "bird-1",
        user_id: "private-user",
        object_key: "private/path.jpg",
        common_name: "European Goldfinch",
        scientific_name: "Carduelis carduelis",
        confidence: 0.96,
        created_at: new Date("2026-09-22T12:00:00Z"),
        common_names: { nl: "Putter" },
        alternatives: ["Eurasian Siskin"],
        evidence: ["red face", "yellow wing bar"],
        preview_key: "previews/private.jpg",
        is_generated: false,
      },
      "https://signed.example/photo",
    ),
  ).toEqual({
    id: "bird-1",
    commonName: "European Goldfinch",
    scientificName: "Carduelis carduelis",
    confidence: 0.96,
    createdAt: new Date("2026-09-22T12:00:00Z"),
    photoUrl: "https://signed.example/photo",
    names: { nl: "Putter" },
    alternatives: ["Eurasian Siskin"],
    evidence: ["red face", "yellow wing bar"],
    isGenerated: false,
  });
});

it("marks generated sightings without exposing their source relationship", () => {
  const databaseRow: SharedIdentificationRow & {
    source_identification_id: string;
    original_photo_url: string;
  } = {
    id: "generated-1",
    user_id: "private-user",
    object_key: "generated/private/result.jpg",
    common_name: "Velvet Teapot Finch",
    scientific_name: "Theiera velutina",
    confidence: 1,
    created_at: new Date("2026-09-24T12:00:00Z"),
    common_names: {},
    alternatives: [],
    evidence: ["AI-generated fictional bird"],
    preview_key: "previews/generated.jpg",
    is_generated: true,
    source_identification_id: "private-source-id",
    original_photo_url: "https://private.example/original",
  };
  const result = toPublicSighting(
    databaseRow,
    "https://signed.example/generated",
  );

  expect(result).toMatchObject({
    isGenerated: true,
    photoUrl: "https://signed.example/generated",
  });
  expect(JSON.stringify(result)).not.toContain("source");
  expect(JSON.stringify(result)).not.toContain("original");
});
