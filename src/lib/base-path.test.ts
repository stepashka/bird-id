import { describe, expect, it } from "vitest";
import { normalizeBasePath } from "./base-path";

describe("normalizeBasePath", () => {
  it("adds leading and trailing slashes", () => {
    expect(normalizeBasePath("bird-id")).toBe("/bird-id/");
  });

  it("preserves the root path", () => {
    expect(normalizeBasePath("/")).toBe("/");
  });
});
