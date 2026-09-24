import { MAX_IMAGE_BYTES } from "./image";

const SCREENSHOT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function feedbackScreenshotKey(
  userId: string,
  contentType: string,
): string {
  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : "jpg";
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

export function feedbackScreenshotError(input: {
  size: number;
  contentType: string;
}): string | null {
  if (input.size === 0) return null;
  if (input.size > MAX_IMAGE_BYTES) {
    return "Screenshots must be 8 MB or smaller.";
  }
  const contentType = input.contentType.split(";")[0]?.trim().toLowerCase();
  if (!contentType || !SCREENSHOT_TYPES.has(contentType)) {
    return "Use a JPEG, PNG, or WebP screenshot.";
  }
  return null;
}

type FeedbackScreenshot = {
  bytes: Uint8Array;
  contentType: string;
};

type PersistFeedbackDependencies = {
  insertFeedback(input: {
    userId: string;
    message: string;
  }): Promise<{ id: string; createdAt: Date }>;
  uploadScreenshot(
    key: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void>;
  attachScreenshot(input: {
    feedbackId: string;
    key: string;
    contentType: string;
  }): Promise<void>;
  deleteFeedback(feedbackId: string): Promise<void>;
  deleteScreenshot(key: string): Promise<void>;
  screenshotKey(userId: string, contentType: string): string;
};

export async function persistFeedback(
  deps: PersistFeedbackDependencies,
  input: {
    userId: string;
    message: string;
    screenshot?: FeedbackScreenshot;
  },
) {
  const row = await deps.insertFeedback({
    userId: input.userId,
    message: input.message,
  });
  if (!input.screenshot) return row;

  const key = deps.screenshotKey(input.userId, input.screenshot.contentType);
  try {
    await deps.uploadScreenshot(
      key,
      input.screenshot.bytes,
      input.screenshot.contentType,
    );
    await deps.attachScreenshot({
      feedbackId: row.id,
      key,
      contentType: input.screenshot.contentType,
    });
    return row;
  } catch (error) {
    await Promise.allSettled([
      deps.deleteScreenshot(key),
      deps.deleteFeedback(row.id),
    ]);
    throw error;
  }
}
