import { describe, expect, it } from "vitest";
import { googleImagesUrl } from "./google-images";

describe("googleImagesUrl", () => {
  it("searches Google Images with the English bird name", () => {
    expect(googleImagesUrl("European goldfinch")).toBe(
      "https://www.google.com/search?tbm=isch&q=European+goldfinch",
    );
  });

  it("returns nothing when the identification is not a bird", () => {
    expect(googleImagesUrl("Not a bird")).toBeNull();
  });
});
