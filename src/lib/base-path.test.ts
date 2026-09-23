import { describe, expect, it } from "vitest";
import { appHomeUrl, normalizeBasePath } from "./base-path";

describe("normalizeBasePath", () => {
  it("adds leading and trailing slashes", () => {
    expect(normalizeBasePath("bird-id")).toBe("/bird-id/");
  });

  it("preserves the root path", () => {
    expect(normalizeBasePath("/")).toBe("/");
  });
});

describe("appHomeUrl", () => {
  it("joins the GitHub Pages origin with the app base path", () => {
    expect(appHomeUrl("https://stepashka.github.io", "/bird-id/")).toBe(
      "https://stepashka.github.io/bird-id/",
    );
  });

  it("stays on the origin root for local development", () => {
    expect(appHomeUrl("http://127.0.0.1:5173", "/")).toBe(
      "http://127.0.0.1:5173/",
    );
  });
});
