import { describe, expect, it, vi } from "vitest";
import { createBirdApi, createPublicBirdApi } from "./browser-api";

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

describe("createPublicBirdApi", () => {
  it("allows a public request without a JWT or Authorization header", async () => {
    const fetcher = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) =>
        Response.json({
          authorization: new Headers(init?.headers).get("Authorization"),
          id: "bird-1",
        }),
    );
    const api = createPublicBirdApi({
      baseUrl: "https://function.example/",
      fetcher,
    });

    await expect(api.request("/shares/token")).resolves.toEqual({
      authorization: null,
      id: "bird-1",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://function.example/shares/token",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("never forwards an Authorization header", async () => {
    const fetcher = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) =>
        Response.json({
          authorization: new Headers(init?.headers).get("Authorization"),
        }),
    );
    const api = createPublicBirdApi({
      baseUrl: "https://function.example",
      fetcher,
    });

    await expect(
      api.request("/shares/token", {
        headers: { Authorization: "Bearer secret" },
      }),
    ).resolves.toEqual({ authorization: null });
  });

  it("surfaces the Function error message", async () => {
    const api = createPublicBirdApi({
      baseUrl: "https://function.example",
      fetcher: async () =>
        Response.json({ error: "This share link is invalid." }, { status: 404 }),
    });

    await expect(api.request("/shares/token")).rejects.toThrow(
      "This share link is invalid.",
    );
  });
});
