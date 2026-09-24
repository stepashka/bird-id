export const NAME_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "nl", label: "Dutch" },
  { code: "ru", label: "Russian" },
  { code: "es", label: "Spanish" },
  { code: "ja", label: "Japanese" },
  { code: "hy", label: "Armenian" },
  { code: "ka", label: "Georgian" },
  { code: "he", label: "Hebrew" },
] as const;

export type NameLanguage = (typeof NAME_LANGUAGES)[number]["code"];
export type LocalizedNames = Partial<Record<NameLanguage, string>>;

const LANGUAGE_CODES = NAME_LANGUAGES.map((language) => language.code);

export function shouldLookupNames(commonName: string, scientificName: string) {
  return (
    commonName.trim().toLowerCase() !== "not a bird" &&
    scientificName.trim().toLowerCase() !== "n/a"
  );
}

function labelValue(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object" || !("value" in raw)) return undefined;
  const value = (raw as { value?: unknown }).value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function parseWikidataBindings(raw: unknown): LocalizedNames {
  if (!raw || typeof raw !== "object") return {};
  const results = (raw as { results?: { bindings?: unknown } }).results;
  const bindings = Array.isArray(results?.bindings) ? results.bindings : [];
  const first = bindings[0];
  if (!first || typeof first !== "object") return {};

  const record = first as Record<string, unknown>;
  const names: LocalizedNames = {};
  for (const code of LANGUAGE_CODES) {
    const value = labelValue(record[code]);
    if (value) names[code] = value;
  }
  return names;
}

export function formatLocalizedNames(names: LocalizedNames | undefined) {
  if (!names) return [];
  return NAME_LANGUAGES.flatMap(({ code, label }) => {
    const value = names[code]?.trim();
    return value ? [`${label}: ${value}`] : [];
  });
}

export async function lookupLocalizedNames(
  commonName: string,
  scientificName: string,
  fetcher: typeof fetch = fetch,
): Promise<LocalizedNames> {
  if (!shouldLookupNames(commonName, scientificName)) return {};

  const query = `
SELECT ?en ?nl ?ru ?es ?ja ?hy ?ka ?he WHERE {
  ?item wdt:P225 "${scientificName.replaceAll('"', "")}" .
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?nl FILTER(LANG(?nl) = "nl") }
  OPTIONAL { ?item rdfs:label ?ru FILTER(LANG(?ru) = "ru") }
  OPTIONAL { ?item rdfs:label ?es FILTER(LANG(?es) = "es") }
  OPTIONAL { ?item rdfs:label ?ja FILTER(LANG(?ja) = "ja") }
  OPTIONAL { ?item rdfs:label ?hy FILTER(LANG(?hy) = "hy") }
  OPTIONAL { ?item rdfs:label ?ka FILTER(LANG(?ka) = "ka") }
  OPTIONAL { ?item rdfs:label ?he FILTER(LANG(?he) = "he") }
}
LIMIT 1`.trim();

  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");

  const response = await fetcher(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "Fieldmark/0.1 (https://stepashka.github.io/bird-id/)",
    },
  });
  if (!response.ok) return {};
  return parseWikidataBindings(await response.json());
}
