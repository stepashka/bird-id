import { describe, expect, it } from "vitest";
import {
  identificationWikipediaUrl,
  wikipediaUrl,
} from "./wikipedia";

describe("wikipediaUrl", () => {
  it("uses a supported browser language and searches by scientific name", () => {
    expect(wikipediaUrl("Carduelis carduelis", "nl-NL")).toBe(
      "https://nl.wikipedia.org/wiki/Special:Search?search=Carduelis+carduelis",
    );
  });

  it("falls back to English for an unsupported browser language", () => {
    expect(wikipediaUrl("Pitangus sulphuratus", "fr-FR")).toBe(
      "https://en.wikipedia.org/wiki/Special:Search?search=Pitangus+sulphuratus",
    );
  });

  it.each([
    ["hy-AM", "hy"],
    ["ka-GE", "ka"],
    ["he-IL", "he"],
  ])("supports %s bird searches", (browserLanguage, wikiLanguage) => {
    expect(wikipediaUrl("Carduelis carduelis", browserLanguage)).toBe(
      `https://${wikiLanguage}.wikipedia.org/wiki/Special:Search?search=Carduelis+carduelis`,
    );
  });
});

describe("identificationWikipediaUrl", () => {
  it("returns no link for a non-bird result", () => {
    expect(
      identificationWikipediaUrl("Not a bird", "n/a", "en-US"),
    ).toBeNull();
  });

  it("keeps the link for a bird result", () => {
    expect(
      identificationWikipediaUrl(
        "European Goldfinch",
        "Carduelis carduelis",
        "en-US",
      ),
    ).toBe(
      "https://en.wikipedia.org/wiki/Special:Search?search=Carduelis+carduelis",
    );
  });
});
