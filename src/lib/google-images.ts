export function googleImagesUrl(englishName: string) {
  const name = englishName.trim();
  if (!name || name.toLowerCase() === "not a bird") return null;

  const url = new URL("https://www.google.com/search");
  url.searchParams.set("tbm", "isch");
  url.searchParams.set("q", name);
  return url.toString();
}
