import { describe, expect, it } from "vitest";
import { googleSignInOptions } from "./google-auth";

describe("googleSignInOptions", () => {
  it("returns Google returning users and first-time signups to the app base path", () => {
    expect(
      googleSignInOptions(
        { origin: "https://stepashka.github.io" },
        "/bird-id/",
      ),
    ).toEqual({
      provider: "google",
      callbackURL: "https://stepashka.github.io/bird-id/",
      newUserCallbackURL: "https://stepashka.github.io/bird-id/",
      errorCallbackURL: "https://stepashka.github.io/bird-id/",
    });
  });

  it("does not use the GitHub origin root as a return URL", () => {
    const options = googleSignInOptions(
      { origin: "https://stepashka.github.io" },
      "/bird-id/",
    );
    expect(options.callbackURL).not.toBe("https://stepashka.github.io/");
    expect(options.newUserCallbackURL).not.toBe("https://stepashka.github.io/");
  });
});
