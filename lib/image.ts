export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ImageValidationError = {
  code: "missing" | "too_large" | "unsupported_type";
  message: string;
};

export function validateImageUpload(input: {
  bytes: Uint8Array;
  contentType: string;
}): ImageValidationError | null {
  if (input.bytes.byteLength === 0) {
    return { code: "missing", message: "Choose a photo of the bird." };
  }
  if (input.bytes.byteLength > MAX_IMAGE_BYTES) {
    return {
      code: "too_large",
      message: "Photos must be 8 MB or smaller.",
    };
  }
  const contentType = input.contentType.split(";")[0]?.trim().toLowerCase();
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    return {
      code: "unsupported_type",
      message: "Use a JPEG, PNG, or WebP photo.",
    };
  }
  return null;
}

export function objectKeyForUser(userId: string, contentType: string): string {
  const ext =
    contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

export function generatedObjectKeyForUser(userId: string) {
  const safeUserId = userId.replace(/[^A-Za-z0-9._-]/g, "_");
  return `generated/${safeUserId}/${crypto.randomUUID()}.jpg`;
}
