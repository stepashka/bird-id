export type BirdIdentification = {
  commonName: string;
  scientificName: string;
  confidence: number;
  alternatives: string[];
  evidence: string[];
};

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
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
    alternatives: stringList(record.alternatives),
    evidence: stringList(record.evidence),
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

export const IDENTIFY_SYSTEM_PROMPT = `You are an expert field ornithologist identifying birds from photographs.
Inspect bill shape, head pattern, wing bars, tail, body proportions, and plumage. Use only marks you can see.
Do not default to common garden birds when those marks disagree.
If evidence is weak, pick the best supported species and lower confidence instead of guessing confidently.
Return JSON only, no markdown, with keys:
- commonName: widely used English name
- scientificName: binomial Latin name
- confidence: number from 0 to 1 for species-level certainty
- alternatives: up to 2 other plausible English names, or []
- evidence: up to 3 short visible field marks, or []
If the photo is not a bird, still fill the keys using commonName "Not a bird" and scientificName "n/a" with low confidence.`;
