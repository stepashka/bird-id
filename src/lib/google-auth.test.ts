import { describe, expect, it } from "vitest";
import { googleSignInOptions } from "./google-auth";

describe("googleSignInOptions", () => {
  it("returns Google social login that comes back to the current page", () => {
    expect(
      googleSignInOptions({
        href: "https://stepashka.github.io/bird-id/",
      }),
    ).toEqual({
      provider: "google",
      callbackURL: "https://stepashka.github.io/bird-id/",
    });
  });
});
