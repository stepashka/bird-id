import type { LocalizedNames } from "../../lib/bird-names";

export type Sighting = {
  id: string;
  commonName: string;
  scientificName: string;
  confidence: number;
  createdAt: string;
  photoUrl: string;
  alternatives?: string[];
  evidence?: string[];
  names?: LocalizedNames;
  shared?: boolean;
  isGenerated?: boolean;
  sourceIdentificationId?: string | null;
  hasGeneratedChild?: boolean;
};

export function confidenceLabel(confidence: number) {
  if (confidence >= 0.8) return "strong match";
  if (confidence >= 0.55) return "likely";
  if (confidence >= 0.3) return "possible";
  return "uncertain";
}
