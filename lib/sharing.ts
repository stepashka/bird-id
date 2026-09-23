import { createHash, randomBytes } from "node:crypto";
import type { LocalizedNames } from "./bird-names";

export type SharedIdentificationRow = {
  id: string;
  user_id: string;
  object_key: string;
  common_name: string;
  scientific_name: string;
  confidence: number;
  created_at: Date;
  common_names: LocalizedNames | null;
  alternatives: string[] | null;
  evidence: string[] | null;
};

export function createShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidShareToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function toPublicSighting(
  row: SharedIdentificationRow,
  photoUrl: string,
) {
  return {
    id: row.id,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    confidence: row.confidence,
    createdAt: row.created_at,
    photoUrl,
    names: row.common_names ?? {},
    alternatives: row.alternatives ?? [],
    evidence: row.evidence ?? [],
  };
}
