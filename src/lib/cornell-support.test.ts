import { describe, expect, it } from "vitest";
import { CORNELL_LAB_DONATE_URL } from "./cornell-support";

describe("Cornell Lab donation link", () => {
  it("points at the official Cornell Lab donate page with a Fieldmark tracking id", () => {
    const url = new URL(CORNELL_LAB_DONATE_URL);

    expect(url.origin + url.pathname).toBe(
      "https://give.birds.cornell.edu/page/87895/donate/1",
    );
    expect(url.searchParams.get("ea.tracking.id")).toBe("FIELDMARK");
  });
});
