import { isNotBirdIdentification } from "../../lib/bird-generation";
import type { Sighting } from "./sighting";

export function canGenerateBird(input: {
  commonName: string;
  scientificName: string;
  isGenerated?: boolean;
  hasGeneratedChild?: boolean;
}) {
  return (
    !input.isGenerated &&
    !input.hasGeneratedChild &&
    isNotBirdIdentification(input.commonName, input.scientificName)
  );
}

export function identificationStartState(sighting: Sighting | null) {
  return {
    sighting,
    generatedSighting: null,
  };
}
