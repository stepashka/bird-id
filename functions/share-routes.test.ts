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
};

function fakeDependencies(
  options: {
    createShareResult?: boolean;
    revokeSharesResult?: boolean;
    sharedRow?: SharedIdentificationRow | null;
  } = {},
): ShareRouteDependencies {
  return {
    resolveUserId: async () => "owner-1",
    createShare: async () => options.createShareResult ?? true,
    revokeShares: async () => options.revokeSharesResult ?? true,
    findShared: async () =>
      "sharedRow" in options ? (options.sharedRow ?? null) : sharedRow,
    signedPhotoUrl: async () => "https://signed.example/photo",
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
