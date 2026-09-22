export type BirdIdentification = {
  commonName: string;
  scientificName: string;
  confidence: number;
};

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function parseIdentification(raw: unknown): BirdIdentification {
  if (!raw || typeof raw !== "object") {
    throw new Error("The model did not return a bird identification.");
  }

  const record = raw as Record<string, unknown>;
  const commonName =
    typeof record.commonName === "string"
      ? record.commonName
      : typeof record.common_name === "string"
        ? record.common_name
        : "";
  const scientificName =
    typeof record.scientificName === "string"
      ? record.scientificName
      : typeof record.scientific_name === "string"
        ? record.scientific_name
        : "";
  const confidenceRaw =
    typeof record.confidence === "number"
      ? record.confidence
      : typeof record.confidence === "string"
        ? Number(record.confidence)
        : NaN;

  if (!commonName.trim() || !scientificName.trim()) {
    throw new Error("The model did not name the bird.");
  }

  return {
    commonName: commonName.trim(),
    scientificName: scientificName.trim(),
    confidence: clampConfidence(confidenceRaw),
  };
}

export function parseIdentificationJson(text: string): BirdIdentification {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The model did not return a bird identification.");
  }
  return parseIdentification(JSON.parse(text.slice(start, end + 1)));
}

export const IDENTIFY_SYSTEM_PROMPT = `You identify birds from photographs for field birders.
Return JSON only, no markdown, with keys:
- commonName: widely used English name
- scientificName: binomial Latin name
- confidence: number from 0 to 1 for how sure you are of the species
If the photo is not a bird, still fill the three keys using commonName "Not a bird" and scientificName "n/a" with low confidence.`;
