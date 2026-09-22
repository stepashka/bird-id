import { describe, expect, it } from "vitest";
import { wikipediaUrl } from "./wikipedia";

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
});
