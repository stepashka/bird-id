const SUPPORTED_LANGUAGES = new Set([
  "en",
  "nl",
  "ru",
  "es",
  "ja",
  "hy",
  "ka",
  "he",
  "uk",
]);

export function wikipediaUrl(scientificName: string, browserLanguage: string) {
  const requestedLanguage = browserLanguage.split("-")[0]?.toLowerCase();
  const language =
    requestedLanguage && SUPPORTED_LANGUAGES.has(requestedLanguage)
      ? requestedLanguage
      : "en";
  const url = new URL(`https://${language}.wikipedia.org/wiki/Special:Search`);
  url.searchParams.set("search", scientificName);
  return url.toString();
}

export function identificationWikipediaUrl(
  commonName: string,
  scientificName: string,
  browserLanguage: string,
) {
  if (
    commonName.trim().toLowerCase() === "not a bird" ||
    scientificName.trim().toLowerCase() === "n/a"
  ) {
    return null;
  }
  return wikipediaUrl(scientificName, browserLanguage);
}
