import { describe, expect, it, vi } from "vitest";
import {
  formatLocalizedNames,
  lookupLocalizedNames,
  NAME_LANGUAGES,
  parseWikidataBindings,
  shouldLookupNames,
} from "./bird-names";

describe("NAME_LANGUAGES", () => {
  it("lists English first, then the rest alphabetically by English name", () => {
    const [first, ...rest] = NAME_LANGUAGES.map((language) => language.label);
    expect(first).toBe("English");
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, "en")));
  });
});

describe("shouldLookupNames", () => {
  it("skips non-birds", () => {
    expect(shouldLookupNames("Not a bird", "n/a")).toBe(false);
  });

  it("looks up a real species", () => {
    expect(shouldLookupNames("European Goldfinch", "Carduelis carduelis")).toBe(
      true,
    );
  });
});

describe("parseWikidataBindings", () => {
  it("keeps only present language labels", () => {
    expect(
      parseWikidataBindings({
        results: {
          bindings: [
            {
              en: { value: "European goldfinch" },
              nl: { value: "Putter" },
              ru: { value: "Черноголовый щегол" },
              ja: { value: "ゴシキヒワ" },
              hy: { value: "Սովորական կարմրակատար" },
              ka: { value: "ჩვეულებრივი ჩიტბატონა" },
              he: { value: "חוחית" },
              uk: { value: "Щиглик" },
            },
          ],
        },
      }),
    ).toEqual({
      en: "European goldfinch",
      nl: "Putter",
      ru: "Черноголовый щегол",
      ja: "ゴシキヒワ",
      hy: "Սովորական կարմրակատար",
      ka: "ჩვეულებრივი ჩიტბატონა",
      he: "חוחית",
      uk: "Щиглик",
    });
  });

  it("returns nothing when Wikidata has no taxon match", () => {
    expect(parseWikidataBindings({ results: { bindings: [] } })).toEqual({});
  });
});

describe("formatLocalizedNames", () => {
  it("renders language labels in a stable order", () => {
    expect(
      formatLocalizedNames({
        ja: "ゴシキヒワ",
        en: "European goldfinch",
        nl: "Putter",
        hy: "Սովորական կարմրակատար",
        ka: "ჩვეულებრივი ჩიტბატონა",
        he: "חוחית",
        uk: "Щиглик",
      }),
    ).toEqual([
      "English: European goldfinch",
      "Armenian: Սովորական կարմրակատար",
      "Dutch: Putter",
      "Georgian: ჩვეულებრივი ჩიტბატონა",
      "Hebrew: חוחית",
      "Japanese: ゴシキヒワ",
      "Ukrainian: Щиглик",
    ]);
  });
});

describe("lookupLocalizedNames", () => {
  it("does not call Wikidata for a non-bird", async () => {
    const fetcher = vi.fn();
    await expect(
      lookupLocalizedNames("Not a bird", "n/a", fetcher),
    ).resolves.toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("queries Wikidata by scientific name", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.hostname).toBe("query.wikidata.org");
      const query = url.searchParams.get("query");
      expect(query).toContain("Carduelis carduelis");
      expect(query).toContain("?uk");
      expect(query).toContain('FILTER(LANG(?uk) = "uk")');
      return Response.json({
        results: {
          bindings: [
            {
              en: { value: "European goldfinch" },
              nl: { value: "Putter" },
            },
          ],
        },
      });
    });

    await expect(
      lookupLocalizedNames("European Goldfinch", "Carduelis carduelis", fetcher),
    ).resolves.toEqual({
      en: "European goldfinch",
      nl: "Putter",
    });
  });
});
