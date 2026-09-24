import { describe, expect, it, vi } from "vitest";
import { AuthError } from "../lib/auth";
import type { SharedIdentificationRow } from "../lib/sharing";
import {
  createShareRoutes,
  type ShareRouteDependencies,
} from "./share-routes";

const sharedRow: SharedIdentificationRow = {
  id: "bird-1",
  user_id: "private-user",
  object_key: "private/photo.jpg",
  common_name: "European Goldfinch",
  scientific_name: "Carduelis carduelis",
  confidence: 0.96,
  created_at: new Date("2026-09-22T12:00:00Z"),
  common_names: { nl: "Putter" },
  alternatives: [],
  evidence: [],
  preview_key: "previews/goldfinch.jpg",
};

function fakeDependencies(
  options: {
    createShareResult?: boolean;
    revokeSharesResult?: boolean;
    sharedRow?: SharedIdentificationRow | null;
    publicAppUrl?: string;
  } = {},
): ShareRouteDependencies {
  return {
    resolveUserId: async () => "owner-1",
    createShare: async () => options.createShareResult ?? true,
    revokeShares: async () => options.revokeSharesResult ?? true,
    findShared: async () =>
      "sharedRow" in options ? (options.sharedRow ?? null) : sharedRow,
    signedPhotoUrl: async () => "https://signed.example/photo",
    publicAppUrl:
      options.publicAppUrl ?? "https://stepashka.github.io/bird-id/",
    getPreviewPhoto: async () => ({
      body: new Uint8Array([255, 216, 255, 217]),
      contentType: "image/jpeg",
    }),
  };
}

describe("share routes", () => {
  it("does not create a share for another user's identification", async () => {
    const app = createShareRoutes(
      fakeDependencies({ createShareResult: false }),
    );
    const response = await app.request("/identifications/bird-1/shares", {
      method: "POST",
      headers: { Authorization: "Bearer owner-jwt" },
    });
    expect(response.status).toBe(404);
  });

  it("returns the token after an owned share is created", async () => {
    const createShare = vi.fn(async () => true);
    const app = createShareRoutes({
      ...fakeDependencies(),
      createShare,
    });
    const response = await app.request("/identifications/bird-1/shares", {
      method: "POST",
      headers: { Authorization: "Bearer owner-jwt" },
    });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.url).toMatch(
      /^http:\/\/localhost\/s\/[A-Za-z0-9_-]{43}$/,
    );
    expect(createShare).toHaveBeenCalledWith({
      identificationId: "bird-1",
      userId: "owner-1",
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("returns the same 404 for invalid and unknown tokens", async () => {
    const app = createShareRoutes(fakeDependencies({ sharedRow: null }));
    expect((await app.request("/shares/invalid")).status).toBe(404);
    expect(
      (await app.request(`/shares/${"a".repeat(43)}`)).status,
    ).toBe(404);
  });

  it("returns only the public sighting fields", async () => {
    const app = createShareRoutes(fakeDependencies({ sharedRow }));
    const response = await app.request(`/shares/${"a".repeat(43)}`);
    const body = await response.json();
    expect(body.userId).toBeUndefined();
    expect(body.objectKey).toBeUndefined();
    expect(body.commonName).toBe("European Goldfinch");
  });

  it("serves token-specific Open Graph HTML without exposing private fields", async () => {
    const app = createShareRoutes(fakeDependencies());
    const token = "a".repeat(43);

    const response = await app.request(`http://localhost/s/${token}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain(
      '<meta property="og:title" content="European Goldfinch">',
    );
    expect(html).toContain(
      '<meta property="og:description" content="Carduelis carduelis · Identified with Fieldmark">',
    );
    expect(html).toContain(
      `<meta property="og:image" content="http://localhost/s/${token}/photo">`,
    );
    expect(html).toContain(
      `https://stepashka.github.io/bird-id/?share=${token}`,
    );
    expect(html).not.toContain("private-user");
    expect(html).not.toContain("private/photo.jpg");
  });

  it("uses the configured app URL for human redirects", async () => {
    const app = createShareRoutes(
      fakeDependencies({ publicAppUrl: "http://127.0.0.1:5173/" }),
    );

    const response = await app.request(`/s/${"a".repeat(43)}`);

    expect(await response.text()).toContain(
      `http://127.0.0.1:5173/?share=${"a".repeat(43)}`,
    );
  });

  it("escapes identification names in social HTML", async () => {
    const app = createShareRoutes(
      fakeDependencies({
        sharedRow: {
          ...sharedRow,
          common_name: `Kea <script>alert("bird")</script>`,
        },
      }),
    );

    const response = await app.request(`/s/${"a".repeat(43)}`);
    const html = await response.text();

    expect(html).not.toContain("<script>alert");
    expect(html).toContain(
      "Kea &lt;script&gt;alert(&quot;bird&quot;)&lt;/script&gt;",
    );
  });

  it("serves the generated preview image through the valid token", async () => {
    const getPreviewPhoto = vi.fn(fakeDependencies().getPreviewPhoto);
    const app = createShareRoutes({
      ...fakeDependencies(),
      getPreviewPhoto,
    });

    const response = await app.request(`/s/${"a".repeat(43)}/photo`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([255, 216, 255, 217]),
    );
    expect(getPreviewPhoto).toHaveBeenCalledWith(
      "previews/goldfinch.jpg",
    );
  });

  it("returns the same unavailable response for revoked social pages and photos", async () => {
    const app = createShareRoutes(fakeDependencies({ sharedRow: null }));
    const token = "a".repeat(43);

    expect((await app.request(`/s/${token}`)).status).toBe(404);
    expect((await app.request(`/s/${token}/photo`)).status).toBe(404);
  });

  it("returns unavailable when a preview object has already been removed", async () => {
    const app = createShareRoutes({
      ...fakeDependencies(),
      getPreviewPhoto: async () => null,
    });

    expect(
      (await app.request(`/s/${"a".repeat(43)}/photo`)).status,
    ).toBe(404);
  });

  it("revokes only an identification owned by the caller", async () => {
    const app = createShareRoutes(
      fakeDependencies({ revokeSharesResult: false }),
    );
    const response = await app.request("/identifications/bird-1/shares", {
      method: "DELETE",
      headers: { Authorization: "Bearer owner-jwt" },
    });
    expect(response.status).toBe(404);
  });

  it("returns success after revoking owned shares", async () => {
    const app = createShareRoutes(fakeDependencies());
    const response = await app.request("/identifications/bird-1/shares", {
      method: "DELETE",
      headers: { Authorization: "Bearer owner-jwt" },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("preserves authentication error statuses", async () => {
    const app = createShareRoutes({
      ...fakeDependencies(),
      resolveUserId: async () => {
        throw new AuthError("Sign in to identify a bird.");
      },
    });
    const response = await app.request("/identifications/bird-1/shares", {
      method: "POST",
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sign in to identify a bird.",
    });
  });

  it("does not expose tokens in unexpected failure responses", async () => {
    const app = createShareRoutes({
      ...fakeDependencies(),
      createShare: async () => {
        throw new Error("database failure");
      },
    });
    const response = await app.request("/identifications/bird-1/shares", {
      method: "POST",
      headers: { Authorization: "Bearer owner-jwt" },
    });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/[A-Za-z0-9_-]{43}/);
  });
});
