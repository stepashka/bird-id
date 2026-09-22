import { describe, expect, it } from "vitest";
import {
  createShareToken,
  hashShareToken,
  isValidShareToken,
  toPublicSighting,
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
  });
});
