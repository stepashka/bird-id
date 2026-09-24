import { describe, expect, it, vi } from "vitest";
import {
  formatLocalizedNames,
  lookupLocalizedNames,
  parseWikidataBindings,
  shouldLookupNames,
} from "./bird-names";

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
      }),
    ).toEqual([
      "English: European goldfinch",
      "Dutch: Putter",
      "Japanese: ゴシキヒワ",
      "Armenian: Սովորական կարմրակատար",
      "Georgian: ჩვეულებრივი ჩიტბატონა",
      "Hebrew: חוחית",
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
      expect(query).toContain("SELECT ?en ?nl ?ru ?es ?ja ?hy ?ka ?he");
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
