import { describe, expect, it, vi } from "vitest";
import {
  publishShare,
  revokePublishedShares,
  type SharePublishingDependencies,
} from "./share-publishing";

function publishingDependencies(
  overrides: Partial<SharePublishingDependencies> = {},
): SharePublishingDependencies {
  return {
    findOwnedIdentification: async () => ({
      id: "bird-1",
      objectKey: "owner/photo.jpg",
      existingPreviewKey: null,
    }),
    loadOriginalPhoto: async () => new Uint8Array([1, 2, 3]),
    renderPreview: async () => new Uint8Array([255, 216, 255, 217]),
    uploadPreview: async () => undefined,
    insertShare: async () => true,
    deletePreview: async () => undefined,
    removeShares: async () => [],
    ...overrides,
  };
}

describe("publishShare", () => {
  it("does not create assets for an identification the caller does not own", async () => {
    const uploadPreview = vi.fn();
    const dependencies = publishingDependencies({
      findOwnedIdentification: async () => null,
      uploadPreview,
    });

    await expect(
      publishShare(dependencies, {
        identificationId: "bird-1",
        userId: "user-1",
        tokenHash: "a".repeat(64),
      }),
    ).resolves.toBe(false);
    expect(uploadPreview).not.toHaveBeenCalled();
  });

  it("creates the resized preview before recording the share", async () => {
    const uploadPreview = vi.fn(async () => undefined);
    const insertShare = vi.fn(async () => true);
    const dependencies = publishingDependencies({
      uploadPreview,
      insertShare,
    });
    const tokenHash = "a".repeat(64);

    await expect(
      publishShare(dependencies, {
        identificationId: "bird-1",
        userId: "user-1",
        tokenHash,
      }),
    ).resolves.toBe(true);

    expect(uploadPreview).toHaveBeenCalledWith(
      `previews/${tokenHash}.jpg`,
      new Uint8Array([255, 216, 255, 217]),
      "image/jpeg",
    );
    expect(insertShare).toHaveBeenCalledWith({
      identificationId: "bird-1",
      userId: "user-1",
      tokenHash,
      previewKey: `previews/${tokenHash}.jpg`,
    });
  });

  it("reuses an existing preview without resizing or uploading again", async () => {
    const loadOriginalPhoto = vi.fn();
    const renderPreview = vi.fn();
    const uploadPreview = vi.fn();
    const insertShare = vi.fn(async () => true);
    const dependencies = publishingDependencies({
      findOwnedIdentification: async () => ({
        id: "bird-1",
        objectKey: "owner/photo.jpg",
        existingPreviewKey: "previews/existing.jpg",
      }),
      loadOriginalPhoto,
      renderPreview,
      uploadPreview,
      insertShare,
    });

    await expect(
      publishShare(dependencies, {
        identificationId: "bird-1",
        userId: "user-1",
        tokenHash: "c".repeat(64),
      }),
    ).resolves.toBe(true);

    expect(loadOriginalPhoto).not.toHaveBeenCalled();
    expect(renderPreview).not.toHaveBeenCalled();
    expect(uploadPreview).not.toHaveBeenCalled();
    expect(insertShare).toHaveBeenCalledWith({
      identificationId: "bird-1",
      userId: "user-1",
      tokenHash: "c".repeat(64),
      previewKey: "previews/existing.jpg",
    });
  });

  it("deletes the generated object when the database insert fails", async () => {
    const deletePreview = vi.fn(async () => undefined);
    const dependencies = publishingDependencies({
      insertShare: async () => {
        throw new Error("database unavailable");
      },
      deletePreview,
    });
    const tokenHash = "b".repeat(64);

    await expect(
      publishShare(dependencies, {
        identificationId: "bird-1",
        userId: "user-1",
        tokenHash,
      }),
    ).rejects.toThrow("database unavailable");
    expect(deletePreview).toHaveBeenCalledWith(
      `previews/${tokenHash}.jpg`,
    );
  });
});

describe("revokePublishedShares", () => {
  it("removes every generated preview returned by the owned revoke", async () => {
    const deletePreview = vi.fn(async () => undefined);
    const dependencies = publishingDependencies({
      removeShares: async () => ["previews/one.jpg", "previews/two.jpg"],
      deletePreview,
    });

    await expect(
      revokePublishedShares(dependencies, {
        identificationId: "bird-1",
        userId: "user-1",
      }),
    ).resolves.toBe(true);
    expect(deletePreview).toHaveBeenCalledTimes(2);
    expect(deletePreview).toHaveBeenCalledWith("previews/one.jpg");
    expect(deletePreview).toHaveBeenCalledWith("previews/two.jpg");
  });

  it("does not remove assets for an identification the caller does not own", async () => {
    const deletePreview = vi.fn();
    const dependencies = publishingDependencies({
      removeShares: async () => null,
      deletePreview,
    });

    await expect(
      revokePublishedShares(dependencies, {
        identificationId: "bird-1",
        userId: "user-1",
      }),
    ).resolves.toBe(false);
    expect(deletePreview).not.toHaveBeenCalled();
  });
});
