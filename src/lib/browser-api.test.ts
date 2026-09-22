import { describe, expect, it, vi } from "vitest";
import { createBirdApi } from "./browser-api";

describe("createBirdApi", () => {
  it("adds the session JWT to Function requests", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get("Authorization");
      return Response.json({ authorization });
    });
    const api = createBirdApi({
      baseUrl: "https://bird-function.example/",
      getToken: async () => "signed-jwt",
      fetcher,
    });

    const result = await api.request<{ authorization: string }>("/history");

    expect(result.authorization).toBe("Bearer signed-jwt");
    expect(fetcher).toHaveBeenCalledWith(
      "https://bird-function.example/history",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("rejects before fetching when no JWT exists", async () => {
    const fetcher = vi.fn();
    const api = createBirdApi({
      baseUrl: "https://bird-function.example",
      getToken: async () => null,
      fetcher,
    });

    await expect(api.request("/history")).rejects.toThrow(
      "Sign in to identify a bird.",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces the Function error message", async () => {
    const api = createBirdApi({
      baseUrl: "https://bird-function.example",
      getToken: async () => "signed-jwt",
      fetcher: async () =>
        Response.json({ error: "Use a JPEG, PNG, or WebP photo." }, { status: 400 }),
    });

    await expect(api.request("/identify", { method: "POST" })).rejects.toThrow(
      "Use a JPEG, PNG, or WebP photo.",
    );
  });
});
