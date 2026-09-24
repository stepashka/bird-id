// English first (the app default). Remaining languages are A–Z by English
// name so the list is a rule, not a ranking of countries or speakers.
export const NAME_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hy", label: "Armenian" },
  { code: "nl", label: "Dutch" },
  { code: "ka", label: "Georgian" },
  { code: "he", label: "Hebrew" },
  { code: "ja", label: "Japanese" },
  { code: "ru", label: "Russian" },
  { code: "es", label: "Spanish" },
  { code: "uk", label: "Ukrainian" },
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

function wikidataNamesQuery(scientificName: string) {
  const select = LANGUAGE_CODES.map((code) => `?${code}`).join(" ");
  const optionals = LANGUAGE_CODES.map(
    (code) =>
      `  OPTIONAL { ?item rdfs:label ?${code} FILTER(LANG(?${code}) = "${code}") }`,
  ).join("\n");
  return `
SELECT ${select} WHERE {
  ?item wdt:P225 "${scientificName.replaceAll('"', "")}" .
${optionals}
}
LIMIT 1`.trim();
}

export async function lookupLocalizedNames(
  commonName: string,
  scientificName: string,
  fetcher: typeof fetch = fetch,
): Promise<LocalizedNames> {
  if (!shouldLookupNames(commonName, scientificName)) return {};

  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", wikidataNamesQuery(scientificName));
  url.searchParams.set("format", "json");

  const response = await fetcher(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "Fieldmark/0.1 (https://bird-id.app/)",
    },
  });
  if (!response.ok) return {};
  return parseWikidataBindings(await response.json());
}
