import { isNotBirdIdentification } from "../../lib/bird-generation";

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
