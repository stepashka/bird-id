import { describe, expect, it } from "vitest";
import { readPublicConfig } from "./public-config";

describe("readPublicConfig", () => {
  it("returns the two public Neon service URLs", () => {
    expect(
      readPublicConfig({
        VITE_NEON_AUTH_URL: "https://auth.example",
        VITE_NEON_FUNCTION_API_URL: "https://function.example/",
      }),
    ).toEqual({
      authUrl: "https://auth.example",
      functionUrl: "https://function.example",
    });
  });

  it("rejects missing public configuration", () => {
    expect(() => readPublicConfig({})).toThrow(
      "VITE_NEON_AUTH_URL and VITE_NEON_FUNCTION_API_URL",
    );
  });
});
