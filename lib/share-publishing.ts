import { socialPreviewKey } from "./social-preview";

export type PublishShareDependencies = {
  findOwnedIdentification(input: {
    identificationId: string;
    userId: string;
  }): Promise<{
    id: string;
    objectKey: string;
    existingPreviewKey: string | null;
  } | null>;
  loadOriginalPhoto(objectKey: string): Promise<Uint8Array>;
  renderPreview(source: Uint8Array): Promise<Uint8Array>;
  uploadPreview(
    previewKey: string,
    body: Uint8Array,
    contentType: "image/jpeg",
  ): Promise<void>;
  insertShare(input: {
    identificationId: string;
    userId: string;
    tokenHash: string;
    previewKey: string;
  }): Promise<boolean>;
  deletePreview(previewKey: string): Promise<void>;
};

export type RevokeShareDependencies = {
  deletePreview(previewKey: string): Promise<void>;
  removeShares(input: {
    identificationId: string;
    userId: string;
  }): Promise<string[] | null>;
};

export type SharePublishingDependencies = PublishShareDependencies &
  RevokeShareDependencies;

export async function publishShare(
  deps: PublishShareDependencies,
  input: {
    identificationId: string;
    userId: string;
    tokenHash: string;
  },
): Promise<boolean> {
  const identification = await deps.findOwnedIdentification({
    identificationId: input.identificationId,
    userId: input.userId,
  });
  if (!identification) return false;

  if (identification.existingPreviewKey) {
    return deps.insertShare({
      ...input,
      previewKey: identification.existingPreviewKey,
    });
  }

  const original = await deps.loadOriginalPhoto(identification.objectKey);
  const preview = await deps.renderPreview(original);
  const previewKey = socialPreviewKey(input.tokenHash);

  try {
    await deps.uploadPreview(previewKey, preview, "image/jpeg");
    const inserted = await deps.insertShare({
      ...input,
      previewKey,
    });
    if (!inserted) {
      await deps.deletePreview(previewKey);
      return false;
    }
    return true;
  } catch (error) {
    await Promise.allSettled([deps.deletePreview(previewKey)]);
    throw error;
  }
}

export async function revokePublishedShares(
  deps: RevokeShareDependencies,
  input: {
    identificationId: string;
    userId: string;
  },
): Promise<boolean> {
  const previewKeys = await deps.removeShares(input);
  if (previewKeys === null) return false;

  await Promise.allSettled(
    previewKeys.map((previewKey) => deps.deletePreview(previewKey)),
  );
  return true;
}
